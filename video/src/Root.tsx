import React from "react";
import { Composition } from "remotion";
import { Launch } from "./Launch";
import { DURATION, FPS } from "./timeline";

export const Root: React.FC = () => (
  <>
    <Composition id="Launch" component={Launch} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ music: true, vo: true, sfx: true }} />
    <Composition id="LaunchNoVO" component={Launch} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ music: true, vo: false, sfx: true }} />
    <Composition id="LaunchSilent" component={Launch} durationInFrames={DURATION} fps={FPS} width={1080} height={1920} defaultProps={{ music: false, vo: false, sfx: false }} />
  </>
);
