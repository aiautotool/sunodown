export type StemSeparationResult={vocals?:string;instrumental?:string;error?:string};
export async function separateVocals(audio:File):Promise<StemSeparationResult>{
 const body=new FormData();body.append('audio',audio);body.append('stem','vocals');
 const response=await fetch('/api/stems',{method:'POST',body});
 const data=await response.json() as StemSeparationResult;
 if(!response.ok)throw new Error(data.error||'Không thể tách vocal');
 return data;
}
