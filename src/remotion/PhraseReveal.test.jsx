import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PhraseReveal } from './PhraseReveal';

vi.mock('remotion', () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 390, height: 300, durationInFrames: 180 }),
  interpolate: (_frame, inputRange, outputRange) => outputRange[0],
  spring: () => 1,
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

const BASE = {
  phrase: 'Bonjour',
  phonetic: 'bohn-ZHOOR',
  translation: 'Hello / Good morning',
  language: 'French',
  example: 'Bonjour, comment ça va?',
  exampleTranslation: 'Hello, how are you?',
  color: '#FF9500',
};

describe('PhraseReveal', () => {
  it('renders without crashing', () => {
    render(<PhraseReveal {...BASE} />);
  });

  it('displays the phrase', () => {
    render(<PhraseReveal {...BASE} />);
    expect(screen.getByText('Bonjour')).toBeInTheDocument();
  });

  it('displays the language badge', () => {
    render(<PhraseReveal {...BASE} />);
    expect(screen.getByText('French')).toBeInTheDocument();
  });

  it('displays phonetic pronunciation', () => {
    render(<PhraseReveal {...BASE} />);
    expect(screen.getByText('bohn-ZHOOR')).toBeInTheDocument();
  });

  it('hides phonetic when empty', () => {
    render(<PhraseReveal {...BASE} phonetic="" />);
    expect(screen.queryByText('bohn-ZHOOR')).not.toBeInTheDocument();
  });

  it('displays the translation', () => {
    render(<PhraseReveal {...BASE} />);
    expect(screen.getByText('Hello / Good morning')).toBeInTheDocument();
  });

  it('displays the example sentence in quotes', () => {
    render(<PhraseReveal {...BASE} />);
    expect(screen.getByText('"Bonjour, comment ça va?"')).toBeInTheDocument();
  });

  it('displays the example translation', () => {
    render(<PhraseReveal {...BASE} />);
    expect(screen.getByText('Hello, how are you?')).toBeInTheDocument();
  });

  it('hides example block when example is empty', () => {
    render(<PhraseReveal {...BASE} example="" />);
    expect(screen.queryByText(/Bonjour, comment/)).not.toBeInTheDocument();
  });

  it('renders with only phrase and translation', () => {
    render(<PhraseReveal phrase="Hola" translation="Hello" />);
    expect(screen.getByText('Hola')).toBeInTheDocument();
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('renders with no props without crashing', () => {
    render(<PhraseReveal />);
  });

  it('has a static durationInFrames of 180', () => {
    expect(PhraseReveal.durationInFrames).toBe(180);
  });
});
