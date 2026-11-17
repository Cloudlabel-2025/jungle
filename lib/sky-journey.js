// Presentation only: all checkpoints derive from the authenticated server snapshot.
export function skyDiscovery(data) {
  const record = data.dayOne?.records?.find((r) => r.userId === data.user._id);
  const staffCompleted = Boolean(record?.levelOne?.result?.completed);
  const genre = Boolean(
    record?.researchSelection || record?.genreId || staffCompleted,
  );
  const question = Boolean(
    record?.researchAssignment || record?.genreId || staffCompleted,
  );
  const submitted = Boolean(record?.submissions?.length || staffCompleted);
  const levelResult = record?.levelOne?.bestResult || record?.levelOne?.result;
  const verified = record?.levelOne
    ? Boolean(levelResult?.completed)
    : submitted && record?.verification?.status === "VERIFIED";
  const ready = record?.levelOne?.automatic?.checks;
  const steps = record?.levelOne?.claimCheckRequired ? [
    {id:"research",title:"Explore with AI",done:Boolean(ready?.checkpoints&&ready?.readable&&ready?.related)},
    {id:"check",title:"Check one claim",done:verified}
  ] : [
    { id: "genre", title: "Find your genre", done: genre },
    { id: "question", title: "Choose your question", done: question },
    { id: "chat", title: "Attach your AI chat", done: submitted },
  ];
  const status = verified
    ? record?.levelOne
      ? record.levelOne.practice
        ? `Replay attempt ${record.levelOne.attempt} · best ${levelResult.stars}/3 stars`
        : `Level complete · ${levelResult.stars}/3 stars`
      : "Evidence verified"
    : submitted
      ? record?.levelOne
        ? (ready?.checkpoints&&ready?.readable&&ready?.related ? "Mission 1 secured · check one claim next" : "Chat checked · correction needed")
        : "Chat received · awaiting verification"
      : question
        ? "Question locked · research next"
        : genre
          ? "Genre locked · choose a question"
          : "Your first mission awaits";
  return {
    steps,
    submitted,
    verified,
    stars: levelResult?.stars || 0,
    status,
    completed: steps.filter((s) => s.done).length,
  };
}

export function skyLevels(data) {
  const discovery = skyDiscovery(data);
  const names = [
    "First discovery",
    "Explore",
    "Tell your STORY",
    "Light the FIRE",
    "Prove your skills",
  ];
  return names.map((title, index) => {
    const day = index + 1;
    const progress = data.weekOneProgram?.progression?.levels?.find(
      (l) => l.day === day,
    );
    if (progress)
      return {
        ...progress,
        title,
        status:
          day === 1 && progress.completed ? discovery.status : progress.status,
        stars: day === 1 ? discovery.stars : progress.stars,
      };
    const release = data.weekOneProgram?.days?.find((d) => d.day === day);
    const state = day === 1 ? data.dayOne?.state : release?.state;
    const saved = data.weekOneProgram?.levelResults?.find((r) => r.userId === data.user._id && r.day === day);
    return {
      day,
      title,
      completed: day === 1 ? discovery.verified : Boolean(saved?.result?.completed),
      stars: day === 1 ? discovery.stars : saved?.result?.stars || 0,
      available: state === "OPEN" || state === "CLOSED",
      open: state === "OPEN",
      status:
        day === 1
          ? discovery.status
          : state === "OPEN"
            ? "Flight mission open"
            : state === "CLOSED"
              ? "Flight mission closed"
              : "Awaiting mission release",
    };
  });
}
