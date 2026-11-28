"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

export default function WorkspaceSelect({id,label,name,options,value,defaultValue,onChange,disabled=false,required=false}) {
  const generated=useId(),controlId=id||generated,listId=`${controlId}-options`;
  const [local,setLocal]=useState(defaultValue??options[0]?.value??"");
  const selected=value??local;
  const [open,setOpen]=useState(false),[query,setQuery]=useState(""),[active,setActive]=useState(0),[position,setPosition]=useState({});
  const trigger=useRef(null),popup=useRef(null),native=useRef(null),search=useRef(null);
  const rows=options.filter(option=>option.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(()=>{
    const form=native.current?.form;
    const reset=()=>{setLocal(defaultValue??options[0]?.value??"");setOpen(false);};
    form?.addEventListener("reset",reset);
    return()=>form?.removeEventListener("reset",reset);
  },[defaultValue,options]);
  useEffect(()=>{
    if(!open)return;
    search.current?.focus();
    const close=event=>{if(!trigger.current?.contains(event.target)&&!popup.current?.contains(event.target))setOpen(false);};
    const scroll=event=>{if(!popup.current?.contains(event.target))setOpen(false);};
    document.addEventListener("pointerdown",close);
    window.addEventListener("scroll",scroll,true);
    window.addEventListener("resize",scroll);
    return()=>{document.removeEventListener("pointerdown",close);window.removeEventListener("scroll",scroll,true);window.removeEventListener("resize",scroll);};
  },[open]);
  useEffect(()=>{if(open)popup.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({block:"nearest"});},[active,open]);
  function show(){
    if(disabled||!options.length)return;
    const rect=trigger.current.getBoundingClientRect(),height=Math.min(330,options.length*44+70,window.innerHeight-24);
    setPosition({left:Math.max(12,Math.min(rect.left,window.innerWidth-rect.width-12)),width:Math.min(rect.width,window.innerWidth-24),top:rect.bottom+height>window.innerHeight?Math.max(12,rect.top-height-6):rect.bottom+6,maxHeight:height});
    setQuery("");setActive(Math.max(0,options.findIndex(option=>String(option.value)===String(selected))));setOpen(true);
  }
  function choose(option){setLocal(option.value);onChange?.(option.value);setOpen(false);trigger.current?.focus();}
  function keys(event){
    if(event.key==="Escape"){event.preventDefault();event.stopPropagation();setOpen(false);trigger.current?.focus();}
    if(event.key==="Tab"){setOpen(false);trigger.current?.focus();}
    if(["ArrowDown","ArrowUp"].includes(event.key)){event.preventDefault();setActive(index=>Math.max(0,Math.min(rows.length-1,index+(event.key==="ArrowDown"?1:-1))));}
    if(event.key==="Enter"){event.preventDefault();if(rows[active])choose(rows[active]);}
  }
  return <div className="workspace-select">
    {label&&<label htmlFor={controlId}>{label}</label>}
    <button ref={trigger} id={controlId} type="button" className="workspace-select-trigger" aria-label={label} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?listId:undefined} disabled={disabled||!options.length} onClick={()=>open?setOpen(false):show()} onKeyDown={event=>{if(event.key==="ArrowDown"||event.key==="ArrowUp"){event.preventDefault();show();}}}><span>{options.find(option=>String(option.value)===String(selected))?.label||"No options available"}</span><ChevronDown size={16} aria-hidden="true"/></button>
    {name&&<select ref={native} className="workspace-select-native" name={name} value={selected} required={required} disabled={disabled} tabIndex={-1} aria-hidden="true" onChange={event=>choose({value:event.target.value})} onInvalid={event=>{event.preventDefault();trigger.current?.focus();}}>{options.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}</select>}
    {open&&createPortal(<div ref={popup} className="workspace-select-popup" style={position} onKeyDown={keys} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}><div className="workspace-select-search"><Search size={15} aria-hidden="true"/><input ref={search} role="combobox" aria-label={`Search ${label||"options"}`} aria-expanded="true" aria-controls={listId} aria-autocomplete="list" aria-activedescendant={rows[active]?`${listId}-${active}`:undefined} placeholder="Search…" value={query} onChange={event=>{setQuery(event.target.value);setActive(0);}}/></div><div id={listId} role="listbox" aria-label={label||"Options"} className="workspace-select-options">{rows.map((option,index)=><button key={option.value} id={`${listId}-${index}`} data-index={index} type="button" role="option" aria-selected={String(selected)===String(option.value)} tabIndex={-1} className={active===index?"is-active":""} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(option)}><span>{option.label}</span>{String(selected)===String(option.value)&&<Check size={16} aria-hidden="true"/>}</button>)}{!rows.length&&<p role="status">No matches found.</p>}</div></div>,trigger.current?.closest('[aria-modal="true"]')||document.body)}
  </div>;
}

