const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const object = value => value && typeof value === "object" && !Array.isArray(value);

// Three-way merge: retain independent edits, and explicitly review competing
// edits to the same field. Arrays (such as component order) are atomic.
export function mergeDraft(base, local, server, prefer = null) {
  const conflicts=[];
  function merge(before, mine, saved, path) {
    if(same(mine,saved)||same(saved,before))return mine;
    if(same(mine,before))return saved;
    if(object(before)&&object(mine)&&object(saved)){
      const result={};
      for(const key of new Set([...Object.keys(before),...Object.keys(mine),...Object.keys(saved)])){
        if(["__proto__","prototype","constructor"].includes(key))continue;
        const value=merge(before[key],mine[key],saved[key],path ? `${path}.${key}` : key);
        if(value!==undefined)result[key]=value;
      }
      return result;
    }
    conflicts.push({field:path,local:mine,server:saved});
    return prefer === "server" ? saved : mine;
  }
  return {value:merge(base,local,server,""),conflicts};
}
