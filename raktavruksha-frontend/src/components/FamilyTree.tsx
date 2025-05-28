import React, { useRef, useEffect, useState, useCallback } from 'react';
import * as d3 from 'd3';
import type { Person, FamilyTreeNode, MarriageNode, GraphNode, GraphLink } from '../types';
import { buildGraphData, getFamilyColors } from '../utils/treeUtils';
import { useTheme } from '../contexts/ThemeContext';

interface FamilyTreeProps {
  people: Person[];
}

// UI Constants
const NODE_PERSON_WIDTH = 150;
const NODE_PERSON_HEIGHT = 60;
const NODE_MARRIAGE_SIZE = 15;

const LINK_DISTANCE = 100; // Longer links
const CHARGE_STRENGTH = -1200; // More repulsion to spread nodes out
const GENERATION_GAP = 900; // Increased vertical gap between generations

// Adjusted to push marriage nodes down relative to spouses
const MARRIAGE_NODE_Y_OFFSET = NODE_PERSON_HEIGHT / 2 + NODE_MARRIAGE_SIZE / 2 + 50; // Offset below person nodes

const COLLISION_PADDING = 10; // Padding around nodes for collision detection

const FamilyTree: React.FC<FamilyTreeProps> = ({ people }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const { theme } = useTheme();

  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.ForceSimulation<GraphNode, GraphLink> | null>(null);
  const colorMap = getFamilyColors(people);


  useEffect(() => {
    if (svgRef.current?.parentElement) {
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          setSvgDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });
      observer.observe(svgRef.current.parentElement);
      return () => observer.disconnect();
    }
  }, []);

  const renderGraph = useCallback(() => {
    if (!svgRef.current || !gRef.current || svgDimensions.width === 0 || svgDimensions.height === 0 || people.length === 0) {
      console.log("Waiting for SVG dimensions or people data...", svgDimensions, people.length);
      return;
    }

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    g.selectAll('*').remove();

    const width = svgDimensions.width;
    const height = svgDimensions.height;


    // Call buildGraphData without a prime person ID, which will default to an initial setup
    const { nodes, links } = buildGraphData(people, null); // Pass null or undefined for primePersonId

    if (nodes.length === 0) {
      console.warn("No nodes to render.");
      return;
    }

    if (!zoomRef.current) {
      zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform.toString());
        });
      svg.call(zoomRef.current);
    }

    const visibleGenerations = nodes.map(d => d.generation).filter(g => g !== undefined && g !== null) as number[];
    const minGen = visibleGenerations.length > 0 ? Math.min(...visibleGenerations) : 0;
    const maxGen = visibleGenerations.length > 0 ? Math.max(...visibleGenerations) : 0;
    const numGenerations = maxGen - minGen + 1;

    const startY = (height - (numGenerations * GENERATION_GAP)) / 2;


    // Initialize Force Simulation
    if (simulationRef.current) {
        simulationRef.current.stop();
    }

    simulationRef.current = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links)
          .id((d: any) => d.id)
          .distance(d => {
              if (d.type === 'parent-marriage' || d.type === 'marriage-child') {
                  return LINK_DISTANCE * 0.1;
              }
              return LINK_DISTANCE;
          }))
      .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('y', d3.forceY(d => {
        const node = d as GraphNode;
        const nodeGen = node.generation !== undefined ? node.generation : 0;
        let yPos = startY + (nodeGen - minGen) * GENERATION_GAP;
        if (node.type === 'marriage') {
            yPos += MARRIAGE_NODE_Y_OFFSET;
        }
        return yPos;
      }).strength(0.8))
      .force('collide', d3.forceCollide<GraphNode>(d => {
        if ((d as any).type === 'marriage') {
          return NODE_MARRIAGE_SIZE / 2 + COLLISION_PADDING;
        }
        return Math.max(NODE_PERSON_WIDTH, NODE_PERSON_HEIGHT) / 2 + COLLISION_PADDING;
      }).iterations(2))
      .alphaDecay(0.02)
      .velocityDecay(0.3);


    // Pre-set initial positions for nodes based on generation for more deterministic layout
    nodes.forEach(node => {
      const nodeGen = (node as GraphNode).generation !== undefined ? (node as GraphNode).generation! : 0;
      let yPos = startY + (nodeGen - minGen) * GENERATION_GAP;
      if ((node as any).type === 'marriage') {
          yPos += MARRIAGE_NODE_Y_OFFSET;
      }
      (node as d3.SimulationNodeDatum).y = yPos;
      (node as d3.SimulationNodeDatum).x = width / 2 + (Math.random() - 0.5) * 50;
    });

    // Initial zoom to fit content - ALWAYS fit, no specific prime person
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodes.forEach(node => {
        const sx = (node as d3.SimulationNodeDatum).x || 0;
        const sy = (node as d3.SimulationNodeDatum).y || 0;
        let nodeWidth = NODE_PERSON_WIDTH;
        let nodeHeight = NODE_PERSON_HEIGHT;
        if ((node as any).type === 'marriage') {
            nodeWidth = NODE_MARRIAGE_SIZE;
            nodeHeight = NODE_MARRIAGE_SIZE;
        }
        minX = Math.min(minX, sx - nodeWidth / 2);
        maxX = Math.max(maxX, sx + nodeWidth / 2);
        minY = Math.min(minY, sy - nodeHeight / 2);
        maxY = Math.max(maxY, sy + nodeHeight / 2);
    });

    const contentWidth = maxX - minX;
    const contentHeight = maxY - minY;

    // Calculate scale to fit content, with a small padding (e.g., 80% of available space)
    const scale = Math.min(width / contentWidth, height / contentHeight, 1) * 0.8;

    // Calculate translation to center the content
    const initialX = (width - contentWidth * scale) / 2 - minX * scale;
    const initialY = (height - contentHeight * scale) / 2 - minY * scale;

    if (zoomRef.current) {
        const initialTransform = d3.zoomIdentity.translate(initialX, initialY).scale(scale);
        svg.call(zoomRef.current.transform, initialTransform);
    }


    // Create Links
    const link = g.append('g')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => {
          if (d.type === 'spouse-spouse') return 3;
          return 1.5;
      })
      .attr('stroke', d => {
          if (d.type === 'spouse-spouse') return 'var(--link-marriage-color)';
          return 'var(--link-color)';
      });


    // Create Nodes (a group 'g' for each node for text and shapes)
    const node = g.append('g')
      .attr('stroke', 'var(--node-stroke-color)')
      .attr('stroke-width', 1.5)
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended));

    // Add elements to each node group
    node.each(function(d) {
      const nodeG = d3.select(this);
      if ((d as any).type === 'marriage') {
        nodeG.append('circle')
          .attr('r', NODE_MARRIAGE_SIZE / 2)
          .attr('fill', 'var(--marriage-node-fill)')
          .attr('stroke', 'var(--marriage-node-stroke)');
      } else {
        const personData = d as FamilyTreeNode;
        nodeG.append('rect')
          .attr('width', NODE_PERSON_WIDTH)
          .attr('height', NODE_PERSON_HEIGHT)
          .attr('rx', 8)
          .attr('ry', 8)
          .attr('x', -NODE_PERSON_WIDTH / 2)
          .attr('y', -NODE_PERSON_HEIGHT / 2)
          .style('fill', 'var(--person-node-fill)')
          .style('stroke', (nodeD: any) => {
            return colorMap[personData.birth_family_id] || 'var(--person-node-border-fallback)';
          })
          .style('stroke-width', 3)

        // First Name
        nodeG.append('text')
          .attr('class', 'first-name-text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('y', -NODE_PERSON_HEIGHT / 4 + 3)
          .text(personData.first_name)
          .style('font-size', '14px')
          .style('font-weight', 'bold')
          .style('fill', 'var(--text-color)')
          .style('stroke', 'none')
          .style('stroke-width', 0)
          .style('user-select', 'none');

        // Last Name
        nodeG.append('text')
          .attr('class', 'last-name-text')
          .attr('text-anchor', 'middle')
          .attr('dominant-baseline', 'central')
          .attr('y', NODE_PERSON_HEIGHT / 4 - 3)
          .text(personData.last_name)
          .style('font-size', '14px')
          .style('fill', 'var(--text-color)')
          .style('stroke', 'none')
          .style('stroke-width', 0)
          .style('user-select', 'none');
      }
    });

    simulationRef.current.on('tick', () => {
      link
        .attr('x1', d => (d.source as d3.SimulationNodeDatum).x!)
        .attr('y1', d => (d.source as d3.SimulationNodeDatum).y!)
        .attr('x2', d => (d.target as d3.SimulationNodeDatum).x!)
        .attr('y2', d => (d.target as d3.SimulationNodeDatum).y!);

      node.attr('transform', d => `translate(${(d as d3.SimulationNodeDatum).x!},${(d as d3.SimulationNodeDatum).y!})`);
    });

    function dragstarted(event: d3.D3DragEvent<SVGGElement, GraphNode, d3.SubjectPosition>) {
      if (!event.active) simulationRef.current!.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, GraphNode, d3.SubjectPosition>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, GraphNode, d3.SubjectPosition>) {
      if (!event.active) simulationRef.current!.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;

    }

  }, [people, svgDimensions, colorMap, theme]); // REMOVE navigate, personIdFromUrl, focusedNodeId from dependencies

  useEffect(() => {
    renderGraph();
  }, [renderGraph]);

  const resetView = useCallback(() => {
    if (svgRef.current && zoomRef.current) {
      const svg = d3.select(svgRef.current);
      // Reset zoom to identity (original scale and position)
      svg.transition().duration(750).call(zoomRef.current.transform, d3.zoomIdentity);
      if (simulationRef.current) {
        // Stop simulation and release fixed positions to let it settle naturally
        simulationRef.current.stop();
        simulationRef.current.nodes().forEach(node => {
          (node as d3.SimulationNodeDatum).fx = null;
          (node as d3.SimulationNodeDatum).fy = null;
        });
        // Restart simulation briefly to let it re-settle (alphaTarget 0 means it will stop once settled)
        simulationRef.current.alpha(1).alphaTarget(0.01).restart();
      }
    }
  }, []); 


  return (
    <div className="family-tree-container">
      {/* <div className="tree-controls">
        <button onClick={resetView} className="control-button">Full View</button>
      </div> */}
      <svg
        ref={svgRef}
        width={svgDimensions.width}
        height={svgDimensions.height}
        style={{ background: 'var(--svg-background)' }}
      >
        <g ref={gRef}></g>
      </svg>
    </div>
  );
};

export default FamilyTree;