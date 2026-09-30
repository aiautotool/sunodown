import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const APP_URL=process.env.EXPO_PUBLIC_NATIVE_WEB_URL||'https://sunoapp.aiautotool.com/';

const injected=`
(function(){
  try {
    document.documentElement.dataset.nativeApp='1';
    window.__SUNODOWN_NATIVE__=true;
    var post=function(payload){
      if(window.ReactNativeWebView&&window.ReactNativeWebView.postMessage){
        window.ReactNativeWebView.postMessage(JSON.stringify(payload));
      }
    };
    var originalOpen=window.open;
    window.open=function(url,target,features){
      if(url){
        post({type:'openExternal',url:String(url),target:target||''});
        return null;
      }
      return originalOpen?originalOpen.apply(window,arguments):null;
    };
    document.addEventListener('click',function(event){
      var target=event.target;
      var anchor=target&&target.closest?target.closest('a[target="_blank"]'):null;
      if(anchor&&anchor.href){
        event.preventDefault();
        post({type:'openExternal',url:String(anchor.href)});
      }
    },true);
    window.dispatchEvent(new CustomEvent('sunodown-native-ready'));
  } catch(e) {}
  true;
})();`;

function NativeApp(){
  const ref=useRef<WebView>(null);
  const [canGoBack,setCanGoBack]=useState(false);
  const [failed,setFailed]=useState(false);

  useEffect(()=>{
    if(Platform.OS!=='android')return;
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(canGoBack){
        ref.current?.goBack();
        return true;
      }
      return false;
    });
    return()=>sub.remove();
  },[canGoBack]);

  const openExternal=useCallback(async(url:string)=>{
    if(!/^https?:|^mailto:|^tel:/i.test(url))return;
    try{await Linking.openURL(url)}catch{}
  },[]);

  const onMessage=useCallback((event:any)=>{
    try{
      const data=JSON.parse(event.nativeEvent.data||'{}');
      if(data?.type==='openExternal'&&typeof data.url==='string')void openExternal(data.url);
    }catch{}
  },[openExternal]);

  const allowNavigation=useCallback((request:any)=>{
    const url=String(request.url||'');
    if(!url||url==='about:blank'||url.startsWith('blob:')||url.startsWith('data:'))return true;
    try{
      const target=new URL(url);
      const app=new URL(APP_URL);
      if(target.origin===app.origin)return true;
    }catch{}
    if(/^https?:|^mailto:|^tel:/i.test(url))void openExternal(url);
    return false;
  },[openExternal]);

  const onNavigation=useCallback((state:WebViewNavigation)=>setCanGoBack(Boolean(state.canGoBack)),[]);

  return <SafeAreaView style={styles.safe} edges={['top','bottom']}>
    <StatusBar style="light" backgroundColor="#070a10"/>
    <View style={styles.root}>
      <WebView
        ref={ref}
        source={{uri:APP_URL}}
        style={styles.web}
        containerStyle={styles.webContainer}
        originWhitelist={['https://*','http://*','blob:*','data:*']}
        injectedJavaScriptBeforeContentLoaded={injected}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={allowNavigation}
        onNavigationStateChange={onNavigation}
        onLoadStart={()=>setFailed(false)}
        onError={()=>setFailed(true)}
        onHttpError={event=>{if(event.nativeEvent.statusCode>=500)setFailed(true)}}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={false}
        allowsBackForwardNavigationGestures
        setSupportMultipleWindows={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        applicationNameForUserAgent="SunoDownNative/24"
      />
      {failed&&<View style={styles.error}>
        <Text style={styles.errorTitle}>Không tải được SunoDown</Text>
        <Text style={styles.errorText}>Kiểm tra kết nối rồi thử tải lại.</Text>
        <Pressable style={styles.retry} onPress={()=>{setFailed(false);ref.current?.reload()}}>
          <Text style={styles.retryText}>Tải lại</Text>
        </Pressable>
      </View>}
    </View>
  </SafeAreaView>
}

export default function App(){
  return <SafeAreaProvider><NativeApp/></SafeAreaProvider>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#070a10'},
  root:{flex:1,backgroundColor:'#070a10'},
  web:{flex:1,backgroundColor:'#070a10'},
  webContainer:{backgroundColor:'#070a10'},
  error:{...StyleSheet.absoluteFill,alignItems:'center',justifyContent:'center',backgroundColor:'#070a10',padding:28},
  errorTitle:{color:'#f7f8fc',fontSize:20,fontWeight:'800'},
  errorText:{color:'#8792a5',fontSize:12,marginTop:8,textAlign:'center'},
  retry:{marginTop:20,minWidth:120,height:42,borderRadius:10,backgroundColor:'#7658ed',alignItems:'center',justifyContent:'center'},
  retryText:{color:'#fff',fontSize:12,fontWeight:'800'},
});
