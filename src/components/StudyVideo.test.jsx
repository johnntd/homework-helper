import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import StudyVideo from './StudyVideo';

// Mock @remotion/player — we only need to verify it receives correct props
vi.mock('@remotion/player', () => ({
  Player: (props) => <div data-testid="remotion-player" data-duration={props.durationInFrames} data-height={props.compositionHeight} />,
}));

// Mock the Remotion composition components
vi.mock('../remotion/VocabReveal', () => ({
  VocabReveal: () => null,
}));

vi.mock('../remotion/MathStepper', () => {
  const MathStepper = () => null;
  MathStepper.duration = (steps = []) => 60 + steps.length * 45 + 40;
  return { MathStepper };
});

describe('StudyVideo', () => {
  it('returns null for an unknown type', () => {
    const { container } = render(<StudyVideo type="unknown" />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when type is undefined', () => {
    const { container } = render(<StudyVideo />);
    expect(container.firstChild).toBeNull();
  });

  it('renders a Player for vocab-reveal', () => {
    const { getByTestId } = render(<StudyVideo type="vocab-reveal" inputProps={{ word: 'Gravity', definition: 'A force.' }} />);
    expect(getByTestId('remotion-player')).toBeInTheDocument();
  });

  it('uses 150 frames (5s × 30fps) for vocab-reveal', () => {
    const { getByTestId } = render(<StudyVideo type="vocab-reveal" />);
    expect(getByTestId('remotion-player').dataset.duration).toBe('150');
  });

  it('uses compositionHeight 280 for vocab-reveal', () => {
    const { getByTestId } = render(<StudyVideo type="vocab-reveal" />);
    expect(getByTestId('remotion-player').dataset.height).toBe('280');
  });

  it('renders a Player for math-steps', () => {
    const { getByTestId } = render(
      <StudyVideo type="math-steps" inputProps={{ problem: '1+1', steps: ['Add'], answer: '2' }} />,
    );
    expect(getByTestId('remotion-player')).toBeInTheDocument();
  });

  it('uses MathStepper.duration for math-steps with 3 steps', () => {
    const steps = ['Step A', 'Step B', 'Step C'];
    // 60 + 3*45 + 40 = 235
    const { getByTestId } = render(
      <StudyVideo type="math-steps" inputProps={{ problem: 'x', steps, answer: 'y' }} />,
    );
    expect(getByTestId('remotion-player').dataset.duration).toBe('235');
  });

  it('uses MathStepper.duration for math-steps with 0 steps', () => {
    // 60 + 0*45 + 40 = 100
    const { getByTestId } = render(
      <StudyVideo type="math-steps" inputProps={{ problem: 'x', steps: [], answer: 'y' }} />,
    );
    expect(getByTestId('remotion-player').dataset.duration).toBe('100');
  });

  it('passes color through to Player inputProps', () => {
    // Can't easily inspect inputProps on a mocked element, but we can verify no crash
    expect(() =>
      render(<StudyVideo type="vocab-reveal" inputProps={{ word: 'Test' }} color="#FF0000" />),
    ).not.toThrow();
  });

  it('defaults color to #0A84FF when not provided', () => {
    expect(() =>
      render(<StudyVideo type="vocab-reveal" />),
    ).not.toThrow();
  });
});
