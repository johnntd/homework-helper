import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MathStepper } from './MathStepper';

vi.mock('remotion', () => ({
  useCurrentFrame: () => 0,
  useVideoConfig: () => ({ fps: 30, width: 390, height: 320, durationInFrames: 235 }),
  interpolate: (_frame, inputRange, outputRange) => outputRange[0],
  spring: () => 1,
  AbsoluteFill: ({ children, style }) => <div style={style}>{children}</div>,
}));

const BASE = {
  problem: 'What is 1/4 + 2/4?',
  steps: [
    'Check the denominators — both are 4.',
    'Add the numerators: 1 + 2 = 3',
    'Keep the denominator: 3/4',
  ],
  answer: '1/4 + 2/4 = 3/4',
  color: '#0A84FF',
};

describe('MathStepper — rendering', () => {
  it('renders without crashing', () => {
    render(<MathStepper {...BASE} />);
  });

  it('displays the problem statement', () => {
    render(<MathStepper {...BASE} />);
    expect(screen.getByText('What is 1/4 + 2/4?')).toBeInTheDocument();
  });

  it('renders the correct number of steps', () => {
    render(<MathStepper {...BASE} />);
    // Each step number (1, 2, 3) is rendered inside a circle
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders each step text', () => {
    render(<MathStepper {...BASE} />);
    BASE.steps.forEach((step) => {
      expect(screen.getByText(step)).toBeInTheDocument();
    });
  });

  it('displays the answer', () => {
    render(<MathStepper {...BASE} />);
    expect(screen.getByText('1/4 + 2/4 = 3/4')).toBeInTheDocument();
  });

  it('does not render answer block when answer is empty', () => {
    render(<MathStepper {...BASE} answer="" />);
    expect(screen.queryByText('1/4 + 2/4 = 3/4')).not.toBeInTheDocument();
  });

  it('renders with zero steps', () => {
    render(<MathStepper problem="What is 2 + 2?" steps={[]} answer="4" />);
    expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
  });

  it('renders with no props without crashing', () => {
    render(<MathStepper />);
  });
});

describe('MathStepper.duration()', () => {
  // Duration = INTRO_FRAMES(60) + steps.length * FRAMES_PER_STEP(45) + OUTRO_FRAMES(40)

  it('returns 100 for 0 steps', () => {
    expect(MathStepper.duration([])).toBe(100);
  });

  it('returns 145 for 1 step', () => {
    expect(MathStepper.duration(['step 1'])).toBe(145);
  });

  it('returns 235 for 3 steps', () => {
    expect(MathStepper.duration(['a', 'b', 'c'])).toBe(235);
  });

  it('returns 325 for 5 steps', () => {
    expect(MathStepper.duration(['a', 'b', 'c', 'd', 'e'])).toBe(325);
  });

  it('defaults to 0 steps when called with no argument', () => {
    expect(MathStepper.duration()).toBe(100);
  });

  it('always returns a positive integer', () => {
    [0, 1, 2, 4, 6].forEach((n) => {
      const duration = MathStepper.duration(Array(n).fill('step'));
      expect(duration).toBeGreaterThan(0);
      expect(Number.isInteger(duration)).toBe(true);
    });
  });
});
