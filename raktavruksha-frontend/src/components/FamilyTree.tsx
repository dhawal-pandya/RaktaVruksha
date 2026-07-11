import React, { useRef, useEffect, useState, useCallback, useLayoutEffect, useMemo } from 'react';
import * as d3 from 'd3';
import type { Person, FamilyTreeNode, MarriageNode, GraphNode, GraphLink } from '../types';
import { buildGraphData, getFamilyColors } from '../utils/treeUtils';
import { useTheme } from '../contexts/ThemeContext';

interface FamilyTreeProps {
  people: Person[];
  onPersonClick: (person: Person) => void;
  familyColors: { [familyId: string]: string };
}

// UI Constants - Adjusted CHARGE_STRENGTH
const NODE_PERSON_WIDTH = 150;
const NODE_PERSON_HEIGHT = 60;
const NODE_MARRIAGE_SIZE = 15;
const LINK_DISTANCE = 100;
const CHARGE_STRENGTH = -900;
const GENERATION_GAP = 420;
const MARRIAGE_NODE_Y_OFFSET = NODE_PERSON_HEIGHT / 2 + NODE_MARRIAGE_SIZE / 2 + 50;
const COLLISION_PADDING = 30;
const SIBLING_SPACING = NODE_PERSON_WIDTH + 80; // horizontal gap between nodes in the same generation

const FamilyTree: React.FC<FamilyTreeProps> = ({ people, onPersonClick, familyColors }) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gRef = useRef<SVGGElement | null>(null);
  const { theme } = useTheme();

  const [svgDimensions, setSvgDimensions] = useState({ width: 0, height: 0 });
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const simulationRef = useRef<d3.ForceSimulation<GraphNode, GraphLink> | null>(null);

  const colorMap = useMemo(() => getFamilyColors(people, familyColors), [people, familyColors]);

  // Use useLayoutEffect for dimension calculation to ensure it runs before browser paint
  useLayoutEffect(() => {
    const parentElement = svgRef.current?.parentElement;
    if (parentElement) {
      const observer = new ResizeObserver(entries => {
        for (let entry of entries) {
          setSvgDimensions({
            width: entry.contentRect.width,
            height: entry.contentRect.height
          });
        }
      });
      observer.observe(parentElement);
      // Set initial dimensions immediately
      setSvgDimensions({
        width: parentElement.offsetWidth,
        height: parentElement.offsetHeight
      });
      return () => observer.disconnect();
    }
  }, []);

  const renderGraph = useCallback(() => {
    // Crucial check: only proceed if we have valid dimensions and people data
    if (!svgRef.current || !gRef.current || svgDimensions.width === 0 || svgDimensions.height === 0 || people.length === 0) {
      console.log("FamilyTree: Not rendering. Missing SVG dimensions or people data.");
      if (gRef.current) d3.select(gRef.current).selectAll('*').remove(); // Clear any existing graph
      if (simulationRef.current) simulationRef.current.stop(); // Stop any running simulation
      return;
    }

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    g.selectAll('*').remove(); // Clear all previous graph elements

    const width = svgDimensions.width;
    const height = svgDimensions.height;

    // Build graph data from the filtered people
    const { nodes, links } = buildGraphData(people, null);

    if (nodes.length === 0) {
      console.warn("FamilyTree: No nodes generated from filtered people data. Skipping rendering.");
      return;
    }

    // Initialize zoom behavior if it doesn't exist
    if (!zoomRef.current) {
      zoomRef.current = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.1, 4])
        .on('zoom', (event) => {
          g.attr('transform', event.transform.toString());
        });
      svg.call(zoomRef.current);
    } else {
      // Reset zoom to identity to prevent issues with previous transformations on new render
      // svg.call(zoomRef.current.transform, d3.zoomIdentity); // This can be aggressive if not desired on every render
      // Instead, we'll apply a fit zoom at the end of simulation.
    }


    const visibleGenerations = nodes.map(d => d.generation).filter(g => g !== undefined && g !== null) as number[];
    // Handle case where only 1 generation or isolated nodes exist
    const minGen = visibleGenerations.length > 0 ? Math.min(...visibleGenerations) : 0;
    const maxGen = visibleGenerations.length > 0 ? Math.max(...visibleGenerations) : 0;
    const numGenerations = Math.max(1, maxGen - minGen + 1); // Ensure at least 1 generation for calculation

    // Calculate initial Y-position for the top generation to center the graph vertically
    const startY = (height - (numGenerations * GENERATION_GAP)) / 2;


    // Stop any existing simulation before creating a new one
    if (simulationRef.current) {
      simulationRef.current.stop();
    }

    // Initialize or re-initialize Force Simulation
    simulationRef.current = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links)
          .id((d: any) => d.id)
          .distance(d => {
              if (d.type === 'parent-marriage' || d.type === 'marriage-child') return LINK_DISTANCE * 0.1;
              return LINK_DISTANCE;
          }))
      .force('charge', d3.forceManyBody().strength(CHARGE_STRENGTH))
      // Weak horizontal centering — prevents drift without fighting the sibling spread
      .force('centerX', d3.forceX(width / 2).strength(0.03))
      .force('y', d3.forceY(d => {
        const node = d as GraphNode;
        const nodeGen = node.generation !== undefined ? node.generation : 0;
        let yPos = startY + (nodeGen - minGen) * GENERATION_GAP;
        if (node.type === 'marriage') {
            yPos += MARRIAGE_NODE_Y_OFFSET;
        }
        return yPos;
      }).strength(0.92)) // High strength keeps every generation locked to its row
      .force('collide', d3.forceCollide<GraphNode>(d => {
        if ((d as any).type === 'marriage') {
          return NODE_MARRIAGE_SIZE / 2 + COLLISION_PADDING;
        }
        return Math.max(NODE_PERSON_WIDTH, NODE_PERSON_HEIGHT) / 2 + COLLISION_PADDING;
      }).iterations(2))
      .alphaDecay(0.02)
      .velocityDecay(0.4);


    // Pre-assign X positions by distributing nodes evenly within each generation row.
    // This gives siblings a correct starting spread so the simulation doesn't have to
    // discover it from scratch (which often produces poor local minima).
    const nodesByGen = new Map<number, typeof nodes>();
    nodes.forEach(node => {
      const gen = (node as any).generation ?? 0;
      if (!nodesByGen.has(gen)) nodesByGen.set(gen, []);
      nodesByGen.get(gen)!.push(node);
    });

    nodes.forEach(node => {
      const gen = (node as any).generation ?? 0;
      const genNodes = nodesByGen.get(gen)!;
      const idx = genNodes.indexOf(node);
      const totalInGen = genNodes.length;

      let yPos = startY + (gen - minGen) * GENERATION_GAP;
      if ((node as any).type === 'marriage') yPos += MARRIAGE_NODE_Y_OFFSET;

      (node as d3.SimulationNodeDatum).y = yPos;
      (node as d3.SimulationNodeDatum).x =
        width / 2 - ((totalInGen - 1) * SIBLING_SPACING) / 2 + idx * SIBLING_SPACING;
    });


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

        // Click and hover on the whole card group (rect + text), not just the rect.
        // Use `d` from the enclosing node.each closure — avoids D3's `unknown` datum typing.
        nodeG
          .style('cursor', 'pointer')
          .on('click', (event: MouseEvent) => {
            event.stopPropagation();
            onPersonClick(d as Person);
          })
          .on('mouseover', function() {
            d3.select(this).select('rect').style('filter', 'brightness(0.88)');
          })
          .on('mouseout', function() {
            d3.select(this).select('rect').style('filter', 'none');
          });

        nodeG.append('rect')
          .attr('width', NODE_PERSON_WIDTH)
          .attr('height', NODE_PERSON_HEIGHT)
          .attr('rx', 8)
          .attr('ry', 8)
          .attr('x', -NODE_PERSON_WIDTH / 2)
          .attr('y', -NODE_PERSON_HEIGHT / 2)
          .style('fill', 'var(--person-node-fill)')
          .style('stroke', () => colorMap[personData.birth_family_id] || 'var(--person-node-border-fallback)')
          .style('stroke-width', 3);

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
          .style('user-select', 'none')
          .style('pointer-events', 'none');

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
          .style('user-select', 'none')
          .style('pointer-events', 'none');
      }
    });

    // Function to calculate and apply initial zoom to fit content
    const applyFitZoom = () => {
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;

        // Iterate over current node positions (which should be more stable now)
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

        // Add safe checks for content dimensions in case nodes are completely collapsed
        if (maxX === -Infinity || minX === Infinity || maxY === -Infinity || minY === Infinity || nodes.length === 0) {
            console.warn("Cannot calculate fit zoom: Invalid bounds or no nodes after simulation.");
            return;
        }

        const contentWidth = maxX - minX;
        const contentHeight = maxY - minY;

        const paddingFactor = 1.1; // 10% padding
        const scaleX = width / (contentWidth * paddingFactor);
        const scaleY = height / (contentHeight * paddingFactor);
        // Choose the smaller scale to fit both dimensions, but never zoom in beyond 1x (initial size)
        const scale = Math.min(scaleX, scaleY, 1);

        const translateX = (width / 2) - ((minX + maxX) / 2) * scale;
        const translateY = (height / 2) - ((minY + maxY) / 2) * scale;

        if (zoomRef.current) {
            const initialTransform = d3.zoomIdentity.translate(translateX, translateY).scale(scale);
            // Apply zoom with a smooth transition
            svg.transition().duration(750).call(zoomRef.current.transform, initialTransform);
        }
    };


    // Attach tick and end handlers for simulation
    simulationRef.current.on('tick', () => {
      link
        .attr('x1', d => (d.source as d3.SimulationNodeDatum).x!)
        .attr('y1', d => (d.source as d3.SimulationNodeDatum).y!)
        .attr('x2', d => (d.target as d3.SimulationNodeDatum).x!)
        .attr('y2', d => (d.target as d3.SimulationNodeDatum).y!);

      node.attr('transform', d => `translate(${(d as d3.SimulationNodeDatum).x!},${(d as d3.SimulationNodeDatum).y!})`);
    });

    // Apply zoom ONLY AFTER the simulation has mostly settled
    simulationRef.current.on('end', () => {
        console.log("Simulation ended, applying fit zoom.");
        applyFitZoom();
    });

    // Start the simulation
    simulationRef.current.alpha(1).restart();


    // Drag handlers
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

  }, [people, svgDimensions, colorMap, familyColors, theme, onPersonClick]);

  // This useEffect will re-run `renderGraph` whenever its dependencies (especially `people` which is the filtered data) change.
  useEffect(() => {
    renderGraph();
  }, [renderGraph]); // `renderGraph` is a useCallback, so this only runs when its own dependencies change.


  // Removed the resetView function and the "Full View" button as per request.

  return (
    <div className="family-tree-container">
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