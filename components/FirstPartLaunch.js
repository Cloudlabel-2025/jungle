"use client";
import {useRef,useState} from "react";
import {Play,CheckCircle2} from "lucide-react";
import {Panel} from "./ui";

export default function FirstPartLaunch({data,act}) {
  const pending=useRef(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  if(data.user.role!=="CENTRE_COMMAND")return null;
  const programme=data.weekOneProgram,opened=Boolean(programme?.flightLaunch?.openedAt),locked=Boolean(programme?.locked);
  async function open(){
    if(pending.current)return;pending.current=true;setBusy(true);setError("");
    try{const result=await act("week1/program/open-first-part",{},"First-part game is open. Players can begin Level 1.");if(result===false)setError("The game could not open. Check the error and try again.");}
    catch(failure){setError(failure.message);}
    finally{pending.current=false;setBusy(false);}
  }
  return <Panel title="First-part game" kicker="FIVE FLIGHT LEVELS" className="first-part-launch">
    <div className="first-part-launch-content"><div><h3>{locked?"Results are finalised":opened?"Your flight is open":"Ready when your players are"}</h3><p>{locked?"Existing results and player work are preserved.":opened?"Players start Level 1 and unlock each next level by completing the previous one.":"Open the game with the built-in research questions and five mission packs. Players progress at their own pace."}</p><small>Custom rules and detailed setup are optional. Published content and saved progress are kept.</small></div><button type="button" className="btn primary" disabled={busy||opened||locked} onClick={open}>{opened?<CheckCircle2 size={18}/>:<Play size={18}/>} {busy?"Opening game…":locked?"Game completed":opened?"First part is open":"Open first-part game"}</button></div>
    {error&&<p className="danger-text" role="alert">{error}</p>}
  </Panel>;
}
