import * as d3 from 'd3';
import type { Person, FamilyTreeNode, MarriageNode, GraphNode, GraphLink } from '../types';

export const getFamilyColors = (
  people: Person[],
  predefinedColors: { [familyId: string]: string } = {}
): { [key: string]: string } => {
  const colorMap: { [key: string]: string } = { ...predefinedColors };

  // Auto-assign d3 colors for any family not covered by predefined colors
  const fallbackColors = d3.schemeCategory10;
  let autoIndex = 0;
  const familyIds = new Set<string>();
  people.forEach(p => {
    familyIds.add(p.birth_family_id);
    if (p.current_family_id) familyIds.add(p.current_family_id);
  });
  familyIds.forEach(id => {
    if (!colorMap[id]) {
      colorMap[id] = fallbackColors[autoIndex % fallbackColors.length];
      autoIndex++;
    }
  });

  return colorMap;
};


/**
 * Calculates generation numbers for all people in the dataset, relative to a prime person.
 * Enforces: Spouses are same generation. Parents are -1 from children.
 *
 * @param allPeople The complete list of all people in the dataset (already filtered for the current view).
 * @param primePersonId The ID of a person whose generation should be considered 0 (optional, but effectively null here).
 * @returns A Map where keys are person IDs and values are their calculated generation numbers.
 */
const calculateGenerations = (allPeople: Person[], primePersonId: string | null = null): Map<string, number> => {
  console.log('calculateGenerations called. People count (passed filtered data):', allPeople.length);

  const generationMap = new Map<string, number>();
  const peopleMap = new Map<string, Person>(); // Map of people currently in the *filtered* view
  allPeople.forEach(p => peopleMap.set(p.id, p));

  let changed = true;
  let iteration = 0;
  const MAX_ITERATIONS = 200; // Increased iterations for more robust convergence

  // Initialize all generations to NaN (unknown)
  allPeople.forEach(p => generationMap.set(p.id, NaN));

  // Set the prime person's generation to 0 if provided and exists in the filtered set.
  // Otherwise, find a suitable default in the filtered set.
  if (primePersonId && peopleMap.has(primePersonId)) {
    generationMap.set(primePersonId, 0);
  } else if (allPeople.length > 0) {
    // Fallback: If no primePersonId or not found, pick a sensible starting point from the *filtered* set:
    // A person with children, preferably an older generation root, or simply the first person.
    const defaultPrime = allPeople.find(p => (p.parents?.length === 0 || !p.parents) && (p.children && p.children.length > 0)) || allPeople[0];
    if (defaultPrime) {
        generationMap.set(defaultPrime.id, 0);
        console.log(`Default prime person for generation 0: ${defaultPrime.id}`);
    } else {
        console.warn("No suitable default prime person found in filtered data.");
        return new Map(); // Return empty map if no people or no default
    }
  } else {
    return new Map(); // No people data in the filtered set
  }

  // Propagate generations outward
  while (changed && iteration < MAX_ITERATIONS) {
    changed = false;
    iteration++;

    // Iterate over a copy to safely modify the map during iteration
    [...allPeople].forEach(person => {
      let currentGen = generationMap.get(person.id)!;

      // Rule 1: Propagate from spouses (STRONG assumption: spouses are same generation)
      if (person.spouses && person.spouses.length > 0) {
        person.spouses.forEach(spouseId => {
          // Only consider spouses that are part of the currently filtered `peopleMap`
          if (peopleMap.has(spouseId)) {
            const spouseGen = generationMap.get(spouseId)!;
            if (!isNaN(spouseGen)) {
              if (isNaN(currentGen) || currentGen !== spouseGen) {
                generationMap.set(person.id, spouseGen);
                currentGen = spouseGen;
                changed = true;
              }
            }
          }
        });
      }

      // Rule 2: Propagate from parents to children
      if (person.parents && person.parents.length > 0) {
        let parentGenSum = 0;
        let knownParentsCount = 0;
        person.parents.forEach(parentId => {
          // Only consider parents that are part of the currently filtered `peopleMap`
          if (peopleMap.has(parentId)) {
            const parentGen = generationMap.get(parentId)!;
            if (!isNaN(parentGen)) {
              parentGenSum += parentGen;
              knownParentsCount++;
            }
          }
        });

        if (knownParentsCount > 0) {
          const impliedChildGen = Math.round(parentGenSum / knownParentsCount) + 1;
          // Only update if it's a tighter constraint or currently unknown
          if (isNaN(currentGen) || impliedChildGen < currentGen) {
             generationMap.set(person.id, impliedChildGen);
             currentGen = impliedChildGen;
             changed = true;
          }
        }
      }

      // Rule 3: Propagate from children to parents
      if (person.children && person.children.length > 0) {
          person.children.forEach(childId => {
              // Only consider children that are part of the currently filtered `peopleMap`
              if (peopleMap.has(childId)) {
                  const childGen = generationMap.get(childId)!;
                  if (!isNaN(childGen)) {
                      const impliedParentGen = childGen - 1;
                      // Only update if it's a tighter constraint or currently unknown
                      if (isNaN(currentGen) || impliedParentGen > currentGen) {
                          generationMap.set(person.id, impliedParentGen);
                          currentGen = impliedParentGen;
                          changed = true;
                      }
                  }
              }
          });
      }
    });
  }

  // Final normalization: shift generations so the 'primePerson' is 0,
  // or the smallest generation calculated is 0 if no prime person or disconnected in the filtered set.
  let primeGenValue = 0;
  if (primePersonId && peopleMap.has(primePersonId) && !isNaN(generationMap.get(primePersonId)!)) {
      primeGenValue = generationMap.get(primePersonId)!;
  } else {
      let minOverallGen = Infinity;
      generationMap.forEach(gen => {
          if (!isNaN(gen)) {
              minOverallGen = Math.min(minOverallGen, gen);
          }
      });
      primeGenValue = minOverallGen !== Infinity ? minOverallGen : 0;
  }

  const normalizedGenerationMap = new Map<string, number>();
  generationMap.forEach((gen, id) => {
    if (!isNaN(gen)) {
      normalizedGenerationMap.set(id, gen - primeGenValue);
    } else {
        // Disconnected individuals in the *filtered* set are also placed at generation 0 relative to the rest.
        normalizedGenerationMap.set(id, 0);
    }
  });

  return normalizedGenerationMap;
};


export const buildGraphData = (allPeople: Person[], primePersonId: string | null = null): { nodes: GraphNode[]; links: GraphLink[] } => {
  console.log('buildGraphData called. People count (passed filtered data):', allPeople.length);

  const peopleMap = new Map<string, Person>();
  allPeople.forEach(p => peopleMap.set(p.id, p)); // Map of people currently in the *filtered* view

  const generationMap = calculateGenerations(allPeople, primePersonId);
  console.log('Generation map from calculateGenerations:', generationMap);


  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const marriageNodesCache = new Map<string, MarriageNode>();

  // Add all people from the filtered list as nodes
  allPeople.forEach(person => {
    const personNode: FamilyTreeNode = {
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      alive: person.alive,
      gender: person.gender,
      parents: person.parents,
      spouses: person.spouses,
      birth_family_id: person.birth_family_id,
      current_family_id: person.current_family_id,
      generation: generationMap.get(person.id), // Ensure generation is set
    };
    nodes.push(personNode);
  });

  // Helper to get or create marriage nodes, ensuring they are only formed from people in the filtered set
  const getOrCreateMarriageNode = (parentIds: string[]): MarriageNode | null => {
    // Ensure both parents are in the currently filtered data
    const validParents = parentIds.filter(id => peopleMap.has(id));
    if (validParents.length !== 2) { // Marriage node requires two parents
      return null;
    }
    const sortedParentIds = [...validParents].sort();
    const marriageKey = `marriage-${sortedParentIds.join('-')}`;

    if (marriageNodesCache.has(marriageKey)) {
      return marriageNodesCache.get(marriageKey)!;
    }

    // Determine generation for marriage node based on spouses' generations
    let marriageGen: number | undefined = undefined;
    const p1Gen = generationMap.get(sortedParentIds[0]);
    const p2Gen = generationMap.get(sortedParentIds[1]);

    if (p1Gen !== undefined && !isNaN(p1Gen)) {
        marriageGen = p1Gen;
    } else if (p2Gen !== undefined && !isNaN(p2Gen)) {
        marriageGen = p2Gen;
    }

    // If no spouse generation is known (unlikely after robust calculation), try to infer from children
    if (marriageGen === undefined || isNaN(marriageGen)) {
        const childrenOfMarriage = allPeople.filter(p =>
            p.parents && p.parents.includes(sortedParentIds[0]) && p.parents.includes(sortedParentIds[1])
            && peopleMap.has(p.id) // Ensure child is also in the filtered set
        );
        if (childrenOfMarriage.length > 0) {
            const childGen = generationMap.get(childrenOfMarriage[0].id);
            if (childGen !== undefined && !isNaN(childGen)) {
                marriageGen = childGen - 1;
            }
        }
    }
    if (marriageGen === undefined || isNaN(marriageGen)) marriageGen = 0; // Final fallback

    const newMarriageNode: MarriageNode = {
      id: marriageKey,
      type: 'marriage',
      spouses: sortedParentIds,
      generation: marriageGen
    };
    marriageNodesCache.set(marriageKey, newMarriageNode);
    nodes.push(newMarriageNode); // Add marriage node to the graph nodes
    return newMarriageNode;
  };

  allPeople.forEach(person => {
    // Spouse-Spouse links: only if both spouses are in the current filtered set
    if (person.spouses && person.spouses.length > 0) {
      person.spouses.forEach(spouseId => {
        if (peopleMap.has(spouseId) && person.id < spouseId) { // Ensure spouse is in filtered set and avoid duplicate links
          links.push({ source: person.id, target: spouseId, type: 'spouse-spouse' });
        }
      });
    }

    // Parent-Child and Marriage-Child links
    if (person.parents && person.parents.length > 0) {
      if (person.parents.length === 2) {
        const marriageNode = getOrCreateMarriageNode(person.parents);
        if (marriageNode) {
          // Both parents known — use the marriage node as the connector
          if (peopleMap.has(person.id)) {
            links.push({ source: marriageNode.id, target: person.id, type: 'marriage-child' });
          }
          person.parents.forEach(parentId => {
            if (peopleMap.has(parentId)) {
              links.push({ source: parentId, target: marriageNode.id, type: 'parent-marriage' });
            }
          });
        } else {
          // One parent is a placeholder not in the data — fall back to direct links for the known parent(s)
          person.parents.forEach(parentId => {
            if (peopleMap.has(parentId) && peopleMap.has(person.id)) {
              links.push({ source: parentId, target: person.id, type: 'parent-child' });
            }
          });
        }
      } else if (person.parents.length === 1) {
        const parentId = person.parents[0];
        if (peopleMap.has(parentId) && peopleMap.has(person.id)) {
          links.push({ source: parentId, target: person.id, type: 'parent-child' });
        }
      }
    }
  });

  // Final check to ensure all links connect valid nodes in the current filtered set
  const finalNodesIds = new Set(nodes.map(n => n.id));
  const finalLinks = links.filter(link => {
      const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
      const targetId = typeof link.target === 'string' ? link.target : link.target.id;
      return finalNodesIds.has(sourceId) && finalNodesIds.has(targetId);
  });

  console.log('Final nodes array from buildGraphData:', nodes.length);
  console.log('Final links array from buildGraphData:', finalLinks.length);

  return { nodes, links: finalLinks };
};