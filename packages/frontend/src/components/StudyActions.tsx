interface Props {
  revealed: boolean;
  playing: boolean;
  disabled: boolean;
  onReveal: () => void;
  onListen: () => void;
  onNext: () => void;
}

export default function StudyActions({ revealed, playing, disabled, onReveal, onListen, onNext }: Props) {
  return <div className="study-actions" aria-label="Flashcard controls">
    <button className="button secondary" onClick={onListen} disabled={playing || disabled}>{playing ? 'Playing…' : 'Listen'}</button>
    <button className="button secondary" onClick={onReveal} disabled={disabled} aria-expanded={revealed}>{revealed ? 'Hide answer' : 'Reveal answer'}</button>
    <button className="button primary" onClick={onNext} disabled={disabled}>Next word <span aria-hidden="true">→</span></button>
    {disabled && <small>Save or cancel your edit to continue.</small>}
  </div>;
}
