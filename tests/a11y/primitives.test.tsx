import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { TextField } from '@/components/primitives/TextField';
import { Button } from '@/components/primitives/Button';
import { OtpInput } from '@/components/primitives/OtpInput';
import { Select } from '@/components/primitives/Select';

/**
 * Accessibility and interaction contracts for the primitives.
 *
 * The design system states these as rules; a rule that is only written down is
 * a rule that gets refactored away. Each test here corresponds to a specific
 * Bhorosha clause whose violation has a documented real-world cost — a cleared
 * OTP box, a shifted submit button, a label that vanishes on first keystroke.
 *
 * These are behaviour tests, not snapshot tests: a snapshot would fail on every
 * cosmetic change and pass on every behavioural regression.
 */

describe('TextField — BDS §10.2.1, §10.2.2', () => {
  it('associates a VISIBLE label with the input, and uses no placeholder-as-label', () => {
    render(<TextField label="মোবাইল নম্বর" />);

    // getByLabelText resolves through htmlFor/id, so this passing means the
    // association is real rather than a visually adjacent <span>.
    const input = screen.getByLabelText('মোবাইল নম্বর');
    expect(input).toBeInTheDocument();

    const label = screen.getByText('মোবাইল নম্বর');
    expect(label.tagName).toBe('LABEL');
    // The label must not be hidden from sighted users — placeholder-as-label
    // destroys the label the moment typing starts.
    expect(label).not.toHaveClass('sr-only');
    expect(input).not.toHaveAttribute('placeholder');
  });

  it('reserves the helper slot even with no helper, error, or success', () => {
    // §10.2.1: an error appearing must not shift the layout. The slot is present
    // and height-reserved at rest, so nothing moves when a message arrives.
    const { container } = render(<TextField label="নাম" />);
    expect(container.querySelector('.min-h-6')).not.toBeNull();
  });

  it('wires aria-invalid and aria-describedby to the error text', () => {
    render(<TextField label="আয়" error="১ থেকে ১২০ এর মধ্যে একটি সংখ্যা লিখুন।" />);

    const input = screen.getByLabelText('আয়');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const description = document.getElementById(describedBy!);
    expect(description).toHaveTextContent('১ থেকে ১২০ এর মধ্যে একটি সংখ্যা লিখুন।');
  });

  it('describes the helper when there is no error, and swaps to the error when there is', () => {
    const { rerender } = render(<TextField label="আয়" helper="মাসিক আয় টাকায়" />);
    const withHelper = screen.getByLabelText('আয়').getAttribute('aria-describedby');
    expect(document.getElementById(withHelper!)).toHaveTextContent('মাসিক আয় টাকায়');

    rerender(<TextField label="আয়" helper="মাসিক আয় টাকায়" error="সংখ্যা লিখুন।" />);
    const withError = screen.getByLabelText('আয়').getAttribute('aria-describedby');
    // Pointing at both would read the helper aloud before the error; the error
    // is the actionable message, so it replaces rather than joins.
    expect(document.getElementById(withError!)).toHaveTextContent('সংখ্যা লিখুন।');
  });

  it('does NOT clear the value when an error appears', () => {
    // Re-entry after a validation error is the top abandonment trigger.
    const { rerender } = render(<TextField label="মোবাইল নম্বর" defaultValue="0171234" />);
    expect(screen.getByLabelText('মোবাইল নম্বর')).toHaveValue('0171234');

    rerender(<TextField label="মোবাইল নম্বর" defaultValue="0171234" error="১১ সংখ্যার নম্বর দিন।" />);
    expect(screen.getByLabelText('মোবাইল নম্বর')).toHaveValue('0171234');
  });

  it('announces the error politely rather than assertively', () => {
    // §10.2.2: an assertive region interrupts a screen-reader user mid-word.
    const { container } = render(<TextField label="আয়" error="সংখ্যা লিখুন।" />);
    const live = container.querySelector('[aria-live]');
    expect(live).toHaveAttribute('aria-live', 'polite');
  });

  it('normalises Bangla digits to Latin when asked', () => {
    const onChange = vi.fn();
    render(<TextField label="বয়স" normaliseDigits onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('বয়স'), { target: { value: '৪২' } });

    // §4.3 keeps Latin digits as the stored form even in the Bangla UI, so a
    // citizen typing on a Bangla keyboard is not silently rejected downstream.
    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls[0]![0].target.value).toBe('42');
  });
});

describe('Button — BDS §10.1', () => {
  it('defaults to the 56 dp size and grows rather than truncating', () => {
    render(<Button>দীর্ঘ একটি বাংলা লেবেল যা দুই লাইনে যেতে পারে</Button>);
    const button = screen.getByRole('button');

    // min-h, not h: a two-line Bangla label must not be clipped (§10.1.8).
    expect(button.className).toContain('min-h-14');
    expect(button.className).toContain('whitespace-normal');
    expect(button.className).not.toMatch(/\btruncate\b/);
  });

  it('pads even the small size to the 48 dp minimum target', () => {
    render(<Button size="sm">ছোট</Button>);
    // §6.3: 40 dp of height plus 4 dp margin top and bottom clears 48 dp.
    expect(screen.getByRole('button').className).toContain('min-h-10');
  });

  it('shows a present-tense sentence while loading, never a bare spinner', () => {
    const { rerender } = render(<Button loadingLabel="পাঠানো হচ্ছে…">জমা দিন</Button>);
    expect(screen.getByRole('button')).toHaveTextContent('জমা দিন');

    rerender(
      <Button loading loadingLabel="পাঠানো হচ্ছে…">
        জমা দিন
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toHaveAttribute('aria-busy', 'true');
    // A sentence, not a wordless spinner — and the resting label is replaced,
    // so the citizen is not left reading a stale call to action.
    expect(button).toHaveTextContent('পাঠানো হচ্ছে…');
    expect(button).not.toHaveTextContent('জমা দিন');
  });

  it('swallows taps while loading so an impatient second tap cannot double-submit', () => {
    const onClick = vi.fn();
    render(
      <Button loading loadingLabel="পাঠানো হচ্ছে…" onClick={onClick}>
        পাঠান
      </Button>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('never leaves a disabled control as an unexplained dead end', () => {
    render(
      <Button disabled disabledReason="এই সুবিধার জন্য একটি টেলিফোন সেবা প্রয়োজন।">
        ভয়েস কল
      </Button>,
    );
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    const describedBy = button.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(
      'এই সুবিধার জন্য একটি টেলিফোন সেবা প্রয়োজন।',
    );
  });
});

describe('OtpInput — BDS §10.2.5', () => {
  function Harness({ error }: { readonly error?: string }) {
    const [value, setValue] = useState('');
    return (
      <OtpInput
        label="৬ সংখ্যার কোড"
        value={value}
        onChange={setValue}
        boxLabel={(n, total) => `বক্স ${n} / ${total}`}
        autoFocus={false}
        {...(error ? { error } : {})}
      />
    );
  }

  it('renders one labelled, VISIBLE box per digit — never a password field', () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes).toHaveLength(6);

    for (const [index, box] of boxes.entries()) {
      expect(box).toHaveAttribute('aria-label', `বক্স ${index + 1} / 6`);
      // Masking an SMS code adds no security — it is already in the SMS — and
      // guarantees typos.
      expect(box).toHaveAttribute('type', 'text');
      expect(box).toHaveAttribute('inputMode', 'numeric');
    }
  });

  it('offers the one-time-code autofill hint on the first box only', () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');
    expect(boxes[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(boxes[1]).toHaveAttribute('autocomplete', 'off');
  });

  it('distributes a pasted code across the boxes', () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox');

    fireEvent.paste(boxes[0]!, {
      clipboardData: { getData: () => '123456' },
    });

    expect(screen.getAllByRole('textbox').map((b) => (b as HTMLInputElement).value)).toEqual([
      '1', '2', '3', '4', '5', '6',
    ]);
  });

  it('accepts a Bangla-numeral paste and normalises it', () => {
    render(<Harness />);
    fireEvent.paste(screen.getAllByRole('textbox')[0]!, {
      clipboardData: { getData: () => '১২৩৪৫৬' },
    });
    expect(screen.getAllByRole('textbox').map((b) => (b as HTMLInputElement).value)).toEqual([
      '1', '2', '3', '4', '5', '6',
    ]);
  });

  it('advances forward on entry and steps back on backspace', () => {
    render(<Harness />);
    const boxes = screen.getAllByRole('textbox') as HTMLInputElement[];

    fireEvent.change(boxes[0]!, { target: { value: '7' } });
    expect(boxes[0]).toHaveValue('7');
    expect(document.activeElement).toBe(boxes[1]);

    // Backspace in an EMPTY box clears the previous one and moves focus there,
    // which is what a citizen expects after over-typing.
    fireEvent.keyDown(boxes[1]!, { key: 'Backspace' });
    expect(screen.getAllByRole('textbox')[0]).toHaveValue('');
    expect(document.activeElement).toBe(boxes[0]);
  });

  it('KEEPS the entered digits when the code is rejected', () => {
    // The single most damaging OTP behaviour is wiping the boxes on error.
    const { rerender, container } = render(<Harness />);
    fireEvent.paste(screen.getAllByRole('textbox')[0]!, {
      clipboardData: { getData: () => '111111' },
    });
    expect(
      screen.getAllByRole('textbox').map((b) => (b as HTMLInputElement).value).join(''),
    ).toBe('111111');

    // The rejection is rendered ALONGSIDE the digits, not instead of them.
    rerender(<Harness error="কোডটি মেলেনি। আবার দেখুন।" />);

    expect(
      screen.getAllByRole('textbox').map((b) => (b as HTMLInputElement).value).join(''),
    ).toBe('111111');

    const group = container.querySelector('[role="group"]')!;
    const errorId = group.getAttribute('aria-describedby');
    expect(document.getElementById(errorId!)).toHaveTextContent('কোডটি মেলেনি। আবার দেখুন।');
    for (const box of screen.getAllByRole('textbox')) {
      expect(box).toHaveAttribute('aria-invalid', 'true');
    }
  });

  it('exposes the boxes as one labelled group, not six anonymous fields', () => {
    const { container } = render(<Harness />);
    const group = container.querySelector('[role="group"]');
    expect(group).not.toBeNull();
    const labelId = group!.getAttribute('aria-labelledby');
    expect(document.getElementById(labelId!)).toHaveTextContent('৬ সংখ্যার কোড');
  });
});

describe('Select — BDS §10.2.6 pattern-by-option-count', () => {
  const two = [
    { value: 'yes' as const, label: 'হ্যাঁ' },
    { value: 'no' as const, label: 'না' },
  ];

  const seven = Array.from({ length: 7 }, (_, i) => ({
    value: `v${i}` as const,
    label: `বিকল্প ${i + 1}`,
  }));

  it('shows every choice as a visible radio at 2–5 options', () => {
    render(<Select label="আপনার কি এনআইডি আছে?" options={two} value={undefined} onChange={() => {}} placeholder="বাছুন" />);

    const radios = screen.getAllByRole('radio');
    expect(radios).toHaveLength(2);
    // A closed dropdown hides the entire choice set from someone who does not
    // know it opens, so there must be no trigger at this option count.
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('switches to a sheet trigger above 5 options, and never a native <select>', () => {
    const { container } = render(
      <Select label="জেলা" options={seven} value={undefined} onChange={() => {}} placeholder="জেলা বাছুন" />,
    );

    expect(screen.getByRole('button')).toBeInTheDocument();
    expect(screen.queryAllByRole('radio')).toHaveLength(0);
    // The OEM-rendered Android picker is inconsistent, small-targeted, and
    // unstyleable, so it is never used above the visible-radio threshold.
    expect(container.querySelector('select')).toBeNull();
  });

  it('keeps the label visible and associated in sheet mode too', () => {
    render(<Select label="জেলা" options={seven} value={undefined} onChange={() => {}} placeholder="জেলা বাছুন" />);
    const label = screen.getByText('জেলা');
    expect(label.tagName).toBe('LABEL');
    expect(label).not.toHaveClass('sr-only');
  });
});
