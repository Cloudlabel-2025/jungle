"use client";
import { useEffect, useRef, useState } from "react";
import { Check, Copy, KeyRound, X } from "lucide-react";

export default function PlayerPasswordResetDialog({player,onReset,onClose,onComplete}) {
  const ref=useRef(null), requestId=useRef(null), pending=useRef(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[result,setResult]=useState(null),[copied,setCopied]=useState(false);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  async function reset(){
    if(pending.current)return;pending.current=true;setBusy(true);setError("");requestId.current ||= crypto.randomUUID();
    try{const saved=await onReset({requestId:requestId.current,version:player.version});setResult(saved);onComplete?.();}
    catch(failure){setError(failure.message);if(failure.status>=400&&failure.status<500)requestId.current=null;}
    finally{pending.current=false;setBusy(false);}
  }
  return <dialog ref={ref} className="pa-dialog player-password-reset" aria-labelledby="player-reset-title" onCancel={event=>{event.preventDefault();if(!busy)onClose();}}>
    <div className="pa-dialog-content"><header><div><span className="pa-kicker">PLAYER ACCOUNT / ASSISTED RECOVERY</span><h2 id="player-reset-title"><KeyRound size={23}/>Reset player password</h2></div><button type="button" className="pa-icon" aria-label="Close password reset" disabled={busy} onClick={onClose}><X size={19}/></button></header>
      <p><strong>{player.name}</strong> · {player.username || "Username not set"}</p>
      {!result ? <><p>Generate a temporary password for this player. Their existing sessions will be signed out, and they must choose a new password after signing in. No email is needed.</p><p className="pa-note">Verify the player’s identity before sharing credentials privately.</p></> : result.temporaryPassword ? <section className="player-reset-secret" aria-label="Temporary player password"><p role="status">Temporary password generated. Share it privately with the player.</p><code>{result.temporaryPassword}</code><button type="button" className="pa-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(result.temporaryPassword);setCopied(true);}catch{setError("Copy could not complete. Select and copy the temporary password manually.");}}}>{copied?<Check size={16}/>:<Copy size={16}/>} {copied?"Copied":"Copy password"}</button><p className="pa-note">This password is shown only in this dialog. The player must replace it after signing in.</p></section> : <p role="status">This reset request already completed. The temporary password is not stored in reset history. If you did not receive it, close this dialog and generate another reset.</p>}
      {error && <p className="pa-error" role="alert">{error}</p>}
      <footer><button type="button" className="pa-secondary" disabled={busy} onClick={onClose}>{result?"Done":"Cancel"}</button>{!result && <button type="button" className="pa-primary" disabled={busy} onClick={reset}>{busy?"Generating…":"Generate temporary password"}</button>}</footer>
    </div>
  </dialog>;
}
