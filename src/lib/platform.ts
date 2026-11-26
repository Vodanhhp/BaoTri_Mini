export function isPcPlatform():boolean{
 if(typeof navigator==='undefined')return true
 const ua=navigator.userAgent||''
 // Checklist execution is phone-only: tablets (including iPadOS desktop-mode UA) are not phones.
 const phone=/iPhone|iPod|Android.*Mobile|Windows Phone|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua)
 return !phone
}
