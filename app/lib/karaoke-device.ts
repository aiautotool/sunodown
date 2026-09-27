export type DeviceHints = {
  userAgent?: string;
  platform?: string;
  maxTouchPoints?: number;
  userAgentDataMobile?: boolean;
};

export function isMobileKaraokeDeviceFromHints({
  userAgent = '',
  platform = '',
  maxTouchPoints = 0,
  userAgentDataMobile,
}: DeviceHints) {
  if (userAgentDataMobile === true) return true;

  if (
    /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(userAgent)
  ) {
    return true;
  }

  // iPadOS can present itself as a Mac desktop browser.
  if (platform === 'MacIntel' && maxTouchPoints > 1) return true;

  return false;
}

export function isMobileKaraokeDevice() {
  if (typeof navigator === 'undefined') return false;
  const nav = navigator as Navigator & {
    userAgentData?: { mobile?: boolean };
  };

  return isMobileKaraokeDeviceFromHints({
    userAgent: nav.userAgent,
    platform: nav.platform,
    maxTouchPoints: nav.maxTouchPoints,
    userAgentDataMobile: nav.userAgentData?.mobile,
  });
}
