/** PortOne V2 browser SDK is loaded only after an explicit PASS button press.
 * Never bundle PortOne API Secret in the frontend.
 * Official docs: https://developers.portone.io/opi/ko/extra/identity-verification/readme-v2
 */
export type PassStartResult = {
  requestId: string;
  identityVerificationId: string;
  storeId: string;
  channelKey: string;
  redirectUrl: string;
};

export async function openGuardianPass(start:PassStartResult):Promise<{code?:string;message?:string;identityVerificationId?:string}|undefined> {
  // Delayed import avoids sharing unrelated guest sessions with a third party.
  const sdkUrl='https://cdn.portone.io/v2/browser-sdk.esm.js';
  const PortOne=await import(/* @vite-ignore */ sdkUrl) as {
    requestIdentityVerification: (params:{
      storeId:string;
      channelKey:string;
      identityVerificationId:string;
      redirectUrl:string;
      bypass:{inicisUnified:{flgFixedUser:'N';directAgency:'PASS'}};
    })=>Promise<{code?:string;message?:string;identityVerificationId?:string}|undefined>;
  };
  return PortOne.requestIdentityVerification({
    storeId:start.storeId,
    channelKey:start.channelKey,
    identityVerificationId:start.identityVerificationId,
    redirectUrl:start.redirectUrl,
    bypass:{inicisUnified:{flgFixedUser:'N',directAgency:'PASS'}},
  });
}
