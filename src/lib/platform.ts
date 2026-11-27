export function isPcPlatform():boolean{
 if(typeof navigator==='undefined')return true
 const ua=navigator.userAgent||''
 // Checklist execution is limited to phone user-agent patterns.
 const phone=/iPhone|iPod|Android.*Mobile|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
 return !phone
}
