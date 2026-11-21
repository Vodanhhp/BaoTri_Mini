export function isPcPlatform():boolean{
 if(typeof navigator==='undefined')return true
 const ua=navigator.userAgent||''
 const mobileOrTablet=/Android|iPhone|iPad|iPod|Mobile|Tablet|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
 const touchMac=navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1
 return !mobileOrTablet&&!touchMac
}
