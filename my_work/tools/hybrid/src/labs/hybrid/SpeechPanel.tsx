import type { RefObject } from "react";
import { Toggle } from "../../components/ControlPanel/Controls";
import { ParameterSlider } from "../../components/ControlPanel/ParameterSlider";
import { PIPE_STEPS, type CompiledLyrics, type SpeechSnapshot } from "./speech/engine";
import type { MotionSample } from "./speech/motion";

export const LYRIC_PRESETS = [
  { id: "cat", label: "He saw the cat", text: "He saw the cat" },
  { id: "kelly", label: "H—EE—S—AW…", text: "H—EE—S—AW—DH—UH—K—AE—T" },
  { id: "daisy", label: "Daisy Bell", text: "Daisy, Daisy, give me your answer do" },
  { id: "mao", label: "他看见猫", text: "他看见那只猫" },
];

export type SpeechSettings = {
  text: string;
  sing: boolean;
  rate: number;
  pitch: number;
};

export const DEFAULT_SPEECH: SpeechSettings = {
  text: "He saw the cat",
  sing: true,
  rate: 1,
  pitch: 120,
};

export function SpeechPanel({
  settings,
  onSettings,
  compiled,
  snap,
  playing,
  onPlay,
  onStop,
  cameraOn,
  onCamera,
  camReady,
  camError,
  motion,
  videoRef,
}: {
  settings: SpeechSettings;
  onSettings: (next: SpeechSettings) => void;
  compiled: CompiledLyrics;
  snap: SpeechSnapshot;
  playing: boolean;
  onPlay: () => void;
  onStop: () => void;
  cameraOn: boolean;
  onCamera: (on: boolean) => void;
  camReady: boolean;
  camError: string | null;
  motion: MotionSample;
  videoRef: RefObject<HTMLVideoElement | null>;
}) {
  const frame = snap.frame;
  return (
    <>
      <h3>歌词 / SPEECH</h3>
      <p className="muted">输入文本即歌词。按 Bell Labs 穿孔卡片码拆成音素，再写成声道参数与声音。</p>
      <p className="muted">音素会即时拆开。要出声请按 PLAY TAPE：会打开扬声器、合成语音并加上低音伴奏。</p>
      <div className="seg">
        {LYRIC_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className={settings.text === p.text ? "active" : ""}
            onClick={() => onSettings({ ...settings, text: p.text })}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="param">
        LYRIC
        <textarea
          rows={3}
          value={settings.text}
          onChange={(e) => onSettings({ ...settings, text: e.target.value })}
          spellCheck={false}
        />
      </label>
      <p className="kelly">{compiled.kelly || "—"}</p>
      <div className="speech-steps">
        {PIPE_STEPS.map((s) => {
          const on = snap.step === s.id;
          return (
            <div key={s.id} className={on ? "speech-step on" : "speech-step"}>
              <b>
                {s.id} {s.zh} / {s.en}
              </b>
              {s.hint}
            </div>
          );
        })}
      </div>
      <div className="seg">
        <button type="button" className={playing ? "active" : ""} onClick={() => (playing ? onStop() : onPlay())}>
          {playing ? "STOP TAPE" : "PLAY TAPE"}
        </button>
        <Toggle label="演唱" on={settings.sing} onChange={(on) => onSettings({ ...settings, sing: on })} />
      </div>
      <ParameterSlider
        label="语速"
        value={settings.rate}
        min={0.5}
        max={1.8}
        step={0.05}
        recMin={0.8}
        recMax={1.2}
        hint="时长缩放，1 为卡片默认"
        onChange={(v) => onSettings({ ...settings, rate: v })}
      />
      <ParameterSlider
        label="基频"
        value={settings.pitch}
        min={80}
        max={240}
        step={1}
        recMin={100}
        recMax={160}
        hint="朗诵基频 Hz；演唱时元音走 Daisy 旋律"
        onChange={(v) => onSettings({ ...settings, pitch: v })}
      />
      {frame && (
        <div className="metrics">
          <div>
            <b>PITCH</b>
            {frame.pitch.toFixed(0)} Hz
          </div>
          <div>
            <b>DUR</b>
            {(snap.dur * 1000).toFixed(0)} ms
          </div>
          <div>
            <b>RATE</b>
            {snap.rate.toFixed(2)}×
          </div>
          <div>
            <b>LOUD</b>
            {frame.loud.toFixed(2)}
          </div>
          <div>
            <b>TONGUE</b>
            {frame.tongueFront.toFixed(2)} / {frame.tongueOpen.toFixed(2)}
          </div>
          <div>
            <b>F1 F2 F3</b>
            {frame.f1.toFixed(0)} {frame.f2.toFixed(0)} {frame.f3.toFixed(0)}
          </div>
          <div>
            <b>TRACT</b>
            B{frame.buzz.toFixed(2)} H{frame.hiss.toFixed(2)}
          </div>
          <div>
            <b>BW</b>
            {frame.b1.toFixed(0)} {frame.b2.toFixed(0)} {frame.b3.toFixed(0)}
          </div>
        </div>
      )}
      <h3>摄像头</h3>
      <p className="muted">
        捕捉动态会改写全部图层，并同时驱动音高、时长、PITCH / DUR、声道参数与 TRACT。请用 localhost 打开。
      </p>
      <Toggle label="捕捉动态" on={cameraOn} onChange={onCamera} />
      <video
        ref={videoRef}
        className={cameraOn ? "cam-preview on" : "cam-preview"}
        playsInline
        muted
        autoPlay
        aria-label="摄像头预览"
      />
      {camError && <p className="hint">{camError}</p>}
      {camReady && (
        <div className="metrics">
          <div>
            <b>MOTION</b>
            {motion.energy.toFixed(2)}
          </div>
          <div>
            <b>POS</b>
            {motion.cx.toFixed(2)} {motion.cy.toFixed(2)}
          </div>
          <div>
            <b>VEL</b>
            {motion.vx.toFixed(3)} {motion.vy.toFixed(3)}
          </div>
        </div>
      )}
    </>
  );
}
