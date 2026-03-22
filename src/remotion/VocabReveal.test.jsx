import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VocabReveal } from './VocabReveal';

// Mock Remotion — components are tested for rendering, not animation values
vi.mock('remotion', () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 390, height: 280, durationInFrames: 150 }),
  interpolate: (_frame, inputRange, outputRange) => outputRange[0],
  spring: () => 1,
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

const BASE = {
  word: 'Photosynthesis',
  phonetic: '/ˌfoʊtəˈsɪnθəsɪs/',
  partOfSpeech: 'noun',
  definition: 'The process by which plants use sunlight to make food.',
  example: 'Leaves carry out photosynthesis during daylight.',
  color: '#34C759',
};

describe('VocabReveal', () => {
  it('renders without crashing', () => {
    render(<VocabReveal {...BASE} />);
  });

  it('displays the word', () => {
    render(<VocabReveal {...BASE} />);
    expect(screen.getByText('Photosynthesis')).toBeInTheDocument();
  });

  it('displays phonetic spelling when provided', () => {
    render(<VocabReveal {...BASE} />);
    expect(screen.getByText('/ˌfoʊtəˈsɪnθəsɪs/')).toBeInTheDocument();
  });

  it('does not render phonetic element when phonetic is empty', () => {
    render(<VocabReveal {...BASE} phonetic="" />);
    expect(screen.queryByText('/ˌfoʊtəˈsɪnθəsɪs/')).not.toBeInTheDocument();
  });

  it('displays part of speech when provided', () => {
    render(<VocabReveal {...BASE} />);
    expect(screen.getByText('noun')).toBeInTheDocument();
  });

  it('does not render part of speech when omitted', () => {
    render(<VocabReveal {...BASE} partOfSpeech="" />);
    expect(screen.queryByText('noun')).not.toBeInTheDocument();
  });

  it('displays definition', () => {
    render(<VocabReveal {...BASE} />);
    expect(screen.getByText(BASE.definition)).toBeInTheDocument();
  });

  it('displays example sentence in quotes', () => {
    render(<VocabReveal {...BASE} />);
    expect(screen.getByText(`"${BASE.example}"`)).toBeInTheDocument();
  });

  it('does not render example block when example is empty', () => {
    render(<VocabReveal {...BASE} example="" />);
    expect(screen.queryByText(/Leaves carry out/)).not.toBeInTheDocument();
  });

  it('renders with only required props (word + definition)', () => {
    render(<VocabReveal word="Gravity" definition="The force that pulls objects down." />);
    expect(screen.getByText('Gravity')).toBeInTheDocument();
    expect(screen.getByText('The force that pulls objects down.')).toBeInTheDocument();
  });

  it('renders with no props without crashing', () => {
    render(<VocabReveal />);
  });
});
