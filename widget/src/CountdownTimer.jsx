import { useEffect, useState } from "preact/hooks";
import { isUrgent, timeLeft } from "./countdown";

const pad = (value) => String(value).padStart(2, "0");

function TimerBox({ timer, urgent = false, children }) {
  return (
    <div
      className={`timedrop__timer timedrop__timer--${timer.size}${urgent ? " timedrop__timer--urgent" : ""}`}
      style={{ background: timer.backgroundColor, color: timer.textColor }}
    >
      {children}
    </div>
  );
}

export function CountdownTimer({ timer, deadline, onEnd }) {
  const [now, setNow] = useState(() => Date.now());
  // Decided once, so the number of segments never changes while counting down.
  const [showDays] = useState(() => timeLeft(deadline, Date.now()).days > 0);
  const remaining = timeLeft(deadline, now);
  const ended = remaining.total === 0;

  useEffect(() => {
    if (ended) {
      onEnd();
      return undefined;
    }
    // Tick on each second boundary so the display stays in step with the clock.
    const tick = setTimeout(() => setNow(Date.now()), 1000 - (Date.now() % 1000));
    return () => clearTimeout(tick);
  }, [now, ended, onEnd]);

  const segments = [
    ...(showDays ? [["Days", remaining.days]] : []),
    ["Hours", remaining.hours],
    ["Mins", remaining.minutes],
    ["Secs", remaining.seconds],
  ];

  return (
    <TimerBox timer={timer} urgent={isUrgent(timer, remaining.total)}>
      <p className="timedrop__message">{timer.message}</p>
      <div className="timedrop__segments" role="timer">
        {segments.map(([label, value]) => (
          <span className="timedrop__segment" key={label}>
            <span className="timedrop__value">{pad(value)}</span>
            <span className="timedrop__label">{label}</span>
          </span>
        ))}
      </div>
    </TimerBox>
  );
}

export function EndedNotice({ timer }) {
  return (
    <TimerBox timer={timer}>
      <p className="timedrop__message">This offer has ended</p>
    </TimerBox>
  );
}
