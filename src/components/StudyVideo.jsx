import { useRef, useEffect } from 'react';
import { Player } from '@remotion/player';
import { VocabReveal } from '../remotion/VocabReveal';
import { MathStepper } from '../remotion/MathStepper';
import { PhraseReveal } from '../remotion/PhraseReveal';
import { ConceptReveal } from '../remotion/ConceptReveal';
import { DailyLessonVideo } from '../remotion/DailyLessonVideo';

const FPS = 30;

/**
 * StudyVideo — embeds a Remotion composition inside StudyBoard.
 *
 * Layout: passes only `width: '100%'` to Player so Remotion's
 * calculatePlayerSize returns `aspectRatio: compositionWidth/compositionHeight`.
 * The browser then computes the height from CSS — no fragile height:100% chain.
 *
 * Audio: sendMessage triggers TTS via setTimeout(500ms). On iOS Safari, async
 * setTimeout calls can be silently dropped after all utterances finish. A 600ms
 * fallback here calls onReplayAudio if nothing is speaking/pending by that time,
 * without double-speaking (if sendMessage's TTS fired, synth.speaking is true).
 */

function getConfig(type, inputProps) {
  switch (type) {
    case 'vocab-reveal': {
      const h = 230
        + (inputProps.phonetic ? 38 : 0)
        + (inputProps.partOfSpeech ? 26 : 0)
        + (inputProps.example ? 64 : 0);
      return { component: VocabReveal, durationInFrames: 5 * FPS, compositionHeight: Math.min(h, 340) };
    }

    case 'concept-reveal': {
      const facts = inputProps.facts ?? [];
      return {
        component: ConceptReveal,
        durationInFrames: ConceptReveal.duration(facts),
        compositionHeight: Math.min(120 + facts.length * 56 + (inputProps.analogy ? 80 : 0), 320),
      };
    }

    case 'phrase-reveal': {
      const h = 240
        + (inputProps.phonetic ? 38 : 0)
        + (inputProps.example ? 60 : 0);
      return { component: PhraseReveal, durationInFrames: PhraseReveal.durationInFrames, compositionHeight: Math.min(h, 340) };
    }

    case 'math-steps': {
      const steps = inputProps.steps ?? [];
      return {
        component: MathStepper,
        durationInFrames: MathStepper.duration(steps),
        compositionHeight: Math.min(100 + steps.length * 64 + 80, 300),
      };
    }

    case 'daily-lesson': {
      const scenes = inputProps.teachingScenes ?? [];
      return {
        component: DailyLessonVideo,
        durationInFrames: DailyLessonVideo.duration(scenes),
        compositionHeight: 300,
      };
    }

    default:
      return null;
  }
}

export default function StudyVideo({ type, inputProps = {}, color = '#0A84FF', onReplayAudio }) {
  const config = getConfig(type, inputProps);
  const playerRef = useRef(null);

  // Audio fallback: sendMessage triggers TTS via setTimeout(500ms), which on iOS
  // Safari can be silently ignored when called outside a user-gesture context.
  // At 600ms after mount, if no speech is active we trigger onReplayAudio ourselves.
  // If sendMessage's TTS already fired, synth.speaking/pending is true → we skip.
  useEffect(() => {
    const timer = setTimeout(() => {
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
      if (!synth || (!synth.speaking && !synth.pending)) {
        onReplayAudio?.();
      }
    }, 600);
    return () => clearTimeout(timer);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!config) return null;

  const { component, durationInFrames, compositionHeight } = config;

  const replay = () => {
    if (playerRef.current) {
      playerRef.current.seekTo(0);
      playerRef.current.play();
    }
    onReplayAudio?.();
  };

  // Pass only width to Player — Remotion's calculatePlayerSize then returns
  // { aspectRatio: '390/compositionHeight' } so the browser computes the height
  // from CSS, eliminating the fragile height:100% → inset:0 → padding-top chain
  // that can resolve to 0px on some Safari versions and cause layout collapse.
  return (
    <div style={{ width: '100%' }}>
      <div style={{ borderRadius: 16, overflow: 'hidden' }}>
        <Player
          ref={playerRef}
          component={component}
          inputProps={{ ...inputProps, color }}
          fps={FPS}
          durationInFrames={Math.max(durationInFrames, 1)}
          compositionWidth={390}
          compositionHeight={compositionHeight}
          style={{ width: '100%' }}
          controls={false}
          autoPlay
          loop={false}
          moveToBeginningWhenEnded={false}
          acknowledgeRemotionLicense
        />
      </div>
      <button
        onClick={replay}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          margin: '8px auto 0',
          padding: '6px 16px',
          background: 'none',
          border: `1.5px solid ${color}60`,
          borderRadius: 20,
          color: color,
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif',
        }}
      >
        <span style={{ fontSize: 15 }}>↺</span> Replay
      </button>
    </div>
  );
}
