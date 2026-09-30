import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';

export function safeFilename(value:string){
  return (value||'sunodown').replace(/[\\/:*?"<>|\r\n]+/g,'-').replace(/\s+/g,' ').trim().slice(0,90)||'sunodown';
}

export async function saveRemoteFile(url:string,filename:string,mimeType:string){
  const name=safeFilename(filename);
  if(Platform.OS==='web'){
    if(typeof document==='undefined')return;
    const anchor=document.createElement('a');
    anchor.href=url;
    anchor.download=name;
    anchor.rel='noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    return;
  }
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const target=base+name.replace(/\s+/g,'-');
  const result=await FileSystem.downloadAsync(url,target);
  if(await Sharing.isAvailableAsync()){
    await Sharing.shareAsync(result.uri,{mimeType,dialogTitle:'Lưu '+name});
  }else{
    await Linking.openURL(url);
  }
}

export async function shareTextFile(contents:string,filename:string,mimeType='text/plain'){
  const name=safeFilename(filename);
  if(Platform.OS==='web'){
    const blob=new Blob([contents],{type:mimeType+';charset=utf-8'});
    const url=URL.createObjectURL(blob);
    try{await saveRemoteFile(url,name,mimeType)}finally{URL.revokeObjectURL(url)}
    return;
  }
  const base=FileSystem.cacheDirectory;
  if(!base)throw new Error('Thiết bị không cấp thư mục cache.');
  const target=base+name.replace(/\s+/g,'-');
  await FileSystem.writeAsStringAsync(target,contents,{encoding:FileSystem.EncodingType.UTF8});
  if(await Sharing.isAvailableAsync())await Sharing.shareAsync(target,{mimeType,dialogTitle:'Lưu '+name});
}


export async function saveExportedAsset(asset:{uri:string;filename:string;mimeType:string;cleanup?:()=>void}){
  try{
    if(Platform.OS==='web'){
      if(typeof document==='undefined')return;
      const anchor=document.createElement('a');
      anchor.href=asset.uri;
      anchor.download=asset.filename;
      anchor.rel='noopener';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      return;
    }
    if(await Sharing.isAvailableAsync()){
      await Sharing.shareAsync(asset.uri,{mimeType:asset.mimeType,dialogTitle:'Lưu '+asset.filename});
    }else{
      await Linking.openURL(asset.uri);
    }
  }finally{
    if(asset.cleanup)setTimeout(asset.cleanup,1200);
  }
}
