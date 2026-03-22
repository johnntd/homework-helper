import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConceptReveal } from './ConceptReveal';

vi.mock('remotion', () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 390, height: 320, durationInFrames: 240 }),
  interpolate: (_frame, inputRange, outputRange) => outputRange[0],
  spring: () => 1,
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

const FACTS = [
  'Water evaporates from oceans when heated by the sun.',
  'Water vapor rises and cools, forming clouds.',
  'Water falls back as rain or snow.',
];

const BASE = {
  title: 'The Water Cycle',
  emoji: '🌊',
  facts: FACTS,
  analogy: 'Think of it like a recycling loop.',
  color: '#0A84FF',
};

describe('ConceptReveal — rendering', () => {
  it('renders without crashing', () => {
    render(<ConceptReveal {...BASE} />);
  });

  it('displays the title', () => {
    render(<ConceptReveal {...BASE} />);
    expect(screen.getByText('The Water Cycle')).toBeInTheDocument();
  });

  it('displays the emoji', () => {
    render(<ConceptReveal {...BASE} />);
    expect(screen.getByText('🌊')).toBeInTheDocument();
  });

  it('renders each fact', () => {
    render(<ConceptReveal {...BASE} />);
    FACTS.forEach((fact) => {
      expect(screen.getByText(fact)).toBeInTheDocument();
    });
  });

  it('renders numbered circles for each fact', () => {
    render(<ConceptReveal {...BASE} />);
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders the analogy', () => {
    render(<ConceptReveal {...BASE} />);
    expect(screen.getByText(/recycling loop/)).toBeInTheDocument();
  });

  it('does not render analogy when omitted', () => {
    render(<ConceptReveal {...BASE} analogy="" />);
    expect(screen.queryByText(/recycling loop/)).not.toBeInTheDocument();
  });

  it('does not render emoji when omitted', () => {
    render(<ConceptReveal {...BASE} emoji="" />);
    expect(screen.queryByText('🌊')).not.toBeInTheDocument();
  });

  it('renders with zero facts', () => {
    render(<ConceptReveal title="Gravity" facts={[]} />);
    expect(screen.getByText('Gravity')).toBeInTheDocument();
  });

  it('renders with no props without crashing', () => {
    render(<ConceptReveal />);
  });
});

describe('ConceptReveal.duration()', () => {
  // INTRO(60) + facts.length * PER_FACT(45) + OUTRO(50)

  it('returns 110 for 0 facts', () => {
    expect(ConceptReveal.duration([])).toBe(110);
  });

  it('returns 155 for 1 fact', () => {
    expect(ConceptReveal.duration(['a'])).toBe(155);
  });

  it('returns 245 for 3 facts', () => {
    expect(ConceptReveal.duration(['a', 'b', 'c'])).toBe(245);
  });

  it('returns 290 for 4 facts', () => {
    expect(ConceptReveal.duration(['a', 'b', 'c', 'd'])).toBe(290);
  });

  it('defaults to 0 facts when called with no argument', () => {
    expect(ConceptReveal.duration()).toBe(110);
  });

  it('always returns a positive integer', () => {
    [0, 1, 2, 3, 4].forEach((n) => {
      const d = ConceptReveal.duration(Array(n).fill('fact'));
      expect(d).toBeGreaterThan(0);
      expect(Number.isInteger(d)).toBe(true);
    });
  });
});
