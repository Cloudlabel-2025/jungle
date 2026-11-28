import { projectLevels } from "./project-catalog.js";
import { fullStackLevel } from "./full-stack-levels.js";

export const missionStarters = projectLevels.slice(0,3).map(level=>({value:level._id,label:level.name}));
export function missionStarter(teams,templateId=missionStarters[0].value) {
  const template=projectLevels.find(level=>level._id===templateId&&missionStarters.some(choice=>choice.value===templateId));
  if(!template)throw new Error("Choose an available mission starter.");
  const {_id,number,...definition}=fullStackLevel(template);
  return {...definition,mapMission:true,hazardKey:"vines",imageKey:"auto",teamIds:teams.map(team=>team._id)};
}
