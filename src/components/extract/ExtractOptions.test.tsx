import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, fallback?: string) => fallback ?? _key }),
}));

import { ExtractOptions } from './ExtractOptions';

/**
 * Wires ExtractOptions the way ExtractPage does: controlled start/end state
 * fed back through onStartTimeChange/onEndTimeChange.
 */
function Harness() {
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(100);

  return (
    <ExtractOptions
      mode="audio"
      onModeChange={() => {}}
      modeAvailable={false}
      format="MP3"
      onFormatChange={() => {}}
      quality="320"
      onQualityChange={() => {}}
      trimEnabled
      onTrimEnabledChange={() => {}}
      trimAvailable
      startTime={startTime}
      endTime={endTime}
      onStartTimeChange={setStartTime}
      onEndTimeChange={setEndTime}
      duration={100}
      disabled={false}
      busy={false}
      onSubmit={() => {}}
    />
  );
}

describe('ExtractOptions trim validation', () => {
  it('keeps submit disabled while the Start field is invalid, even after End is blurred untouched', () => {
    render(<Harness />);

    const startInput = screen.getByLabelText('Start');
    const submitButton = screen.getByTestId('submit-media-btn');

    // Type an unparsable timecode into Start and commit it via blur.
    fireEvent.change(startInput, { target: { value: 'abc' } });
    fireEvent.blur(startInput);

    expect(submitButton).toBeDisabled();

    // Focusing and blurring End — with no edit at all — re-commits its
    // already-valid value. Both TimecodeInput instances report validity
    // through the same shared `timeError` state in ExtractOptions, so End's
    // "I'm valid" signal clobbers Start's still-active "I'm invalid" one.
    const endInput = screen.getByLabelText('End');
    fireEvent.focus(endInput);
    fireEvent.blur(endInput);

    expect(submitButton).toBeDisabled();
  });
});
