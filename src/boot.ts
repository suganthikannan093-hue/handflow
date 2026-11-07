// Optional desktop emulation of a Meta Quest 3 with hands via IWER (add ?emulate to the URL).
async function boot() {
  if (new URLSearchParams(location.search).has('emulate')) {
    const { XRDevice, metaQuest3 } = await import('iwer'); const d = new XRDevice(metaQuest3); d.installRuntime({ forceInstall: true }); d.primaryInputMode = 'hand'; d.position.set(0, 1.2, 0.35);
    (window as unknown as { __iwer?: unknown }).__iwer = d;
  }
  await import('./main');
}
boot();
