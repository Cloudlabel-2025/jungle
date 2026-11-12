const disciplines = {
  "QA-13": "functional",
  "QA-14": "functional",
  "OP-15": "nonFunctional",
  "DB-15": "nonFunctional",
  "BE-13": "system",
  "QA-15": "system",
};

export function sprint4Discipline(code) {
  return /^UAT-0[1-5]$/.test(code) ? "uat" : disciplines[code];
}
