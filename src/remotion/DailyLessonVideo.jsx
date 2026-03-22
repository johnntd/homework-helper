import { Series, AbsoluteFill } from 'remotion';
import { LessonIntro } from './LessonIntro';
import { ConceptReveal } from './ConceptReveal';
import { PhraseReveal } from './PhraseReveal';
import { PracticePrompt } from './PracticePrompt';
import { RecapScene } from './RecapScene';

/**
 * DailyLessonVideo — full 6-scene daily lesson orchestrator.
 *
 * Chains all scene types using <Series> for a seamless lesson flow:
 *   1. LessonIntro        (10s)
 *   2. ConceptReveal × 3  (dynamic, based on facts count)
 *   3. PhraseReveal        (6s — pronunciation/vocabulary scene)
 *   4. PracticePrompt     (7s)
 *   5. RecapScene         (9s)
 *
 * Duration: DailyLessonVideo.duration(teachingScenes)
 *
 * Props:
 *   color              string    — accent color for all scenes
 *   intro              object    — { title, subtitle, emoji }
 *   teachingScenes     object[]  — [{ title, emoji, facts[], analogy }]
 *   pronunciationScene object    — { phrase, phonetic, translation, language, example, exampleTranslation }
 *   practicePrompt     object    — { question, hint }
 *   recap              object    — { title, points[] }
 */
export const DailyLessonVideo = ({
  color = '#0A84FF',
  intro = {},
  teachingScenes = [],
  pronunciationScene = {},
  practicePrompt = {},
  recap = {},
}) => {
  return (
    <AbsoluteFill style={{ background: '#F2F2F7' }}>
      <Series>
        {/* Scene 1: Intro */}
        <Series.Sequence durationInFrames={LessonIntro.durationInFrames}>
          <LessonIntro
            title={intro.title || 'Today\'s Lesson'}
            subtitle={intro.subtitle || ''}
            emoji={intro.emoji || '📚'}
            color={color}
          />
        </Series.Sequence>

        {/* Scenes 2–4: Teaching scenes (ConceptReveal) */}
        {teachingScenes.map((scene, i) => {
          const facts = scene.facts ?? [];
          return (
            <Series.Sequence key={i} durationInFrames={ConceptReveal.duration(facts)}>
              <ConceptReveal
                title={scene.title || ''}
                emoji={scene.emoji || ''}
                facts={facts}
                analogy={scene.analogy || ''}
                color={color}
              />
            </Series.Sequence>
          );
        })}

        {/* Scene 5: Pronunciation */}
        <Series.Sequence durationInFrames={PhraseReveal.durationInFrames}>
          <PhraseReveal
            phrase={pronunciationScene.phrase || ''}
            phonetic={pronunciationScene.phonetic || ''}
            translation={pronunciationScene.translation || ''}
            language={pronunciationScene.language || 'English'}
            example={pronunciationScene.example || ''}
            exampleTranslation={pronunciationScene.exampleTranslation || ''}
            color={color}
          />
        </Series.Sequence>

        {/* Scene 6: Practice prompt */}
        <Series.Sequence durationInFrames={PracticePrompt.durationInFrames}>
          <PracticePrompt
            question={practicePrompt.question || 'What did you learn today?'}
            hint={practicePrompt.hint || 'Think carefully!'}
            color={color}
          />
        </Series.Sequence>

        {/* Scene 7: Recap */}
        <Series.Sequence durationInFrames={RecapScene.durationInFrames}>
          <RecapScene
            title={recap.title || 'Great work today!'}
            points={recap.points ?? []}
            color={color}
          />
        </Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

/**
 * Total frame count for a DailyLessonVideo.
 * @param {Array} teachingScenes — array of scene objects with .facts[]
 */
DailyLessonVideo.duration = (teachingScenes = []) =>
  LessonIntro.durationInFrames +
  teachingScenes.reduce((sum, s) => sum + ConceptReveal.duration(s.facts ?? []), 0) +
  PhraseReveal.durationInFrames +
  PracticePrompt.durationInFrames +
  RecapScene.durationInFrames;
