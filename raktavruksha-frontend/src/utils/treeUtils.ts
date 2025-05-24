// src/utils/treeUtils.ts
import * as d3 from 'd3';
import type { Person, FamilyTreeNode, MarriageNode, GraphNode, GraphLink } from '../types';

export const getFamilyColors = (people: Person[]): { [key: string]: string } => {
  const familyIds = new Set<string>();
  people.forEach(p => {
    familyIds.add(p.birth_family_id);
    familyIds.add(p.current_family_id);
  });

  const colors = d3.schemeCategory10;
  const colorMap: { [key: string]: string } = {};
  Array.from(familyIds).forEach((id, index) => {
    colorMap[id] = colors[index % colors.length];
  });
  return colorMap;
};


/**
 * Calculates generation numbers for all people in the dataset, relative to a prime person.
 * Enforces: Spouses are same generation. Parents are -1 from children.
 *
 * @param allPeople The complete list of all people in the dataset.
 * @param primePersonId The ID of the person whose generation should be considered 0.
 * @returns A Map where keys are person IDs and values are their calculated generation numbers.
 */
const calculateGenerations = (allPeople: Person[], primePersonId: string | null = null): Map<string, number> => {
  const generationMap = new Map<string, number>();
  const peopleMap = new Map<string, Person>();
  allPeople.forEach(p => peopleMap.set(p.id, p));

  let changed = true;
  let iteration = 0;
  const MAX_ITERATIONS = 200; // Increased iterations for more robust convergence

  // Initialize all generations to NaN (unknown)
  allPeople.forEach(p => generationMap.set(p.id, NaN));

  // Set the prime person's generation to 0
  if (primePersonId && peopleMap.has(primePersonId)) {
    generationMap.set(primePersonId, 0);
  } else if (allPeople.length > 0) {
    // Fallback: If no primePersonId or not found, pick a sensible starting point:
    // A person with children, preferably an older generation root.
    const defaultPrime = allPeople.find(p => (p.parents?.length === 0 || !p.parents) && (p.children && p.children.length > 0)) || allPeople[0];
    generationMap.set(defaultPrime.id, 0);
  } else {
    return new Map(); // No people data
  }


  // Propagate generations outward
  while (changed && iteration < MAX_ITERATIONS) {
    changed = false;
    iteration++;

    // Create a copy of the people array for this iteration to avoid modifying while iterating
    // and to ensure all nodes are processed even if their gen changes mid-loop
    [...allPeople].forEach(person => {
      let currentGen = generationMap.get(person.id)!;

      // Rule 1: Propagate from spouses (STRONG assumption: spouses are same generation)
      if (person.spouses && person.spouses.length > 0) {
        person.spouses.forEach(spouseId => {
          const spouse = peopleMap.get(spouseId);
          if (spouse) {
            const spouseGen = generationMap.get(spouseId)!;
            if (!isNaN(spouseGen)) { // If spouse's generation is known
              if (isNaN(currentGen) || currentGen !== spouseGen) { // If current is unknown or different
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
          const parentGen = generationMap.get(parentId)!;
          if (!isNaN(parentGen)) {
            parentGenSum += parentGen;
            knownParentsCount++;
          }
        });

        if (knownParentsCount > 0) {
          const impliedChildGen = Math.round(parentGenSum / knownParentsCount) + 1;
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
              const childGen = generationMap.get(childId)!;
              if (!isNaN(childGen)) {
                  const impliedParentGen = childGen - 1;
                  if (isNaN(currentGen) || impliedParentGen > currentGen) {
                      generationMap.set(person.id, impliedParentGen);
                      currentGen = impliedParentGen;
                      changed = true;
                  }
              }
          });
      }
    });
  }

  // Final normalization: shift generations so the 'primePerson' is 0,
  // or the smallest generation calculated is 0 if no prime person or disconnected.
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
        normalizedGenerationMap.set(id, 0); // Disconnected individuals to generation 0
    }
  });

  return normalizedGenerationMap;
};


export const buildGraphData = (allPeople: Person[], primePersonId: string | null = null): { nodes: GraphNode[]; links: GraphLink[] } => {
  const peopleMap = new Map<string, Person>();
  allPeople.forEach(p => peopleMap.set(p.id, p));

  const generationMap = calculateGenerations(allPeople, primePersonId);

  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const marriageNodesCache = new Map<string, MarriageNode>();

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
      generation: generationMap.get(person.id),
    };
    nodes.push(personNode);
  });

  const getOrCreateMarriageNode = (parentIds: string[]): MarriageNode => {
    const sortedParentIds = [...parentIds].sort();
    const marriageKey = `marriage-${sortedParentIds.join('-')}`;
    if (marriageNodesCache.has(marriageKey)) {
      return marriageNodesCache.get(marriageKey)!;
    }

    // Determine generation for marriage node:
    // It should be the same generation as the spouses.
    let marriageGen: number | undefined = undefined;
    if (sortedParentIds.length > 0) {
        const p1Gen = generationMap.get(sortedParentIds[0]);
        if (p1Gen !== undefined && !isNaN(p1Gen)) {
            marriageGen = p1Gen;
        } else if (sortedParentIds.length > 1) {
            const p2Gen = generationMap.get(sortedParentIds[1]);
            if (p2Gen !== undefined && !isNaN(p2Gen)) {
                marriageGen = p2Gen;
            }
        }
    }
    // If no spouse generation is known (unlikely after robust calculation),
    // try to infer from children or default to 0.
    if (marriageGen === undefined || isNaN(marriageGen)) {
        const childrenOfMarriage = allPeople.filter(p => p.parents && p.parents.includes(sortedParentIds[0]) && p.parents.includes(sortedParentIds[1]));
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
    nodes.push(newMarriageNode);
    return newMarriageNode;
  };

  allPeople.forEach(person => {
    if (person.spouses && person.spouses.length > 0) {
      person.spouses.forEach(spouseId => {
        if (peopleMap.has(spouseId) && person.id < spouseId) {
          links.push({ source: person.id, target: spouseId, type: 'spouse-spouse' });
        }
      });
    }

    if (person.parents && person.parents.length > 0) {
      if (person.parents.length === 2) {
        const marriageNode = getOrCreateMarriageNode(person.parents);
        links.push({ source: marriageNode.id, target: person.id, type: 'marriage-child' });

        person.parents.forEach(parentId => {
          if (peopleMap.has(parentId)) {
            links.push({ source: parentId, target: marriageNode.id, type: 'parent-marriage' });
          }
        });
      } else if (person.parents.length === 1) {
        const parentId = person.parents[0];
        if (peopleMap.has(parentId)) {
          links.push({ source: parentId, target: person.id, type: 'parent-child' });
        }
      }
    }
  });

  return { nodes, links };
};