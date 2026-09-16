'use client';
import {useEffect} from 'react';
const SAMPLE='https://suno.com/s/0Uzw4fboYOyOzHjc';
export function V8DefaultSunoSample(){useEffect(()=>{const timer=setTimeout(()=>{const input=[...document.querySelectorAll('input')].find(x=>x.placeholder?.includes('Dán link Suno')) as HTMLInputElement|undefined;if(!input||input.value)return;const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')?.set;setter?.call(input,SAMPLE);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}))},120);return()=>clearTimeout(timer)},[]);return null}
