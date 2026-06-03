const music = document.getElementById("bgMusic");
const musicToggle = document.getElementById("musicToggle");
const musicIcon = document.getElementById("musicIcon");
const flap = document.getElementById("flap");
const scene = document.querySelector(".envelope-scene");
const invite = document.getElementById("invite");
const wrapper = document.getElementById("wrapper");
const revealSections = Array.from(document.querySelectorAll(".fold, .gift-note"));

let muted = false;
let musicStarted = false;
const defaultMusicVolume = 0.08;
let revealObserver = null;
let mutedByInactivity = false;
let audioCtx = null;
let musicSource = null;
let gainNode = null;
let currentVolume = defaultMusicVolume;

const applyMusicState = (volume = currentVolume) => {
  currentVolume = volume;

  if (gainNode) {
    gainNode.gain.value = muted || mutedByInactivity ? 0 : volume;
    return;
  }

  music.volume = muted || mutedByInactivity ? 0 : volume;
};

const setupAudioGain = async () => {
  if (!music || gainNode) return;

  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  audioCtx = new AudioContextClass();
  musicSource = audioCtx.createMediaElementSource(music);
  gainNode = audioCtx.createGain();

  musicSource.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }
};

const startMusic = async () => {
  if (!music || musicStarted) return;

  musicStarted = true;

  try {
    await setupAudioGain();
    applyMusicState(defaultMusicVolume);
    await music.play();
  } catch (error) {
    musicStarted = false;
    console.log("Music playback failed:", error);
  }
};

if ("scrollRestoration" in window.history) {
  window.history.scrollRestoration = "manual";
}

const resetToTop = () => {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
};

const initializeSectionReveal = () => {
  if (!revealSections.length) return;

  revealSections.forEach((section, index) => {
    section.classList.add("reveal-section");
    section.classList.toggle("is-visible", index === 0);
  });

  if (!("IntersectionObserver" in window)) {
    revealSections.forEach((section) => {
      section.classList.add("is-visible");
    });
    return;
  }

  revealObserver?.disconnect();
  revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      entry.target.classList.add("is-visible");
      revealObserver.unobserve(entry.target);
    });
  }, {
    threshold: 0.2,
    rootMargin: "0px 0px -12% 0px"
  });

  revealSections.slice(1).forEach((section) => {
    revealObserver.observe(section);
  });
};

window.addEventListener("load", () => {
  document.body.classList.add("envelope-locked");
  resetToTop();
  window.requestAnimationFrame(resetToTop);
  initializeSectionReveal();
});

window.addEventListener("pageshow", () => {
  document.body.classList.add("envelope-locked");
  resetToTop();
  initializeSectionReveal();
});

if (flap && scene && invite && wrapper) {
  flap.addEventListener("click", async () => {
    resetToTop();
    await startMusic();

    flap.classList.add("open");
    wrapper.classList.add("envelope-open");
    scene.classList.add("opening");

    window.setTimeout(() => {
      wrapper.classList.add("fade-out");
      document.body.classList.remove("envelope-locked");
      invite.classList.add("show");
    }, 1600);
  });
}

if (musicToggle && music && musicIcon) {
  musicToggle.addEventListener("click", async () => {
    if (!musicStarted) {
      await startMusic();
      return;
    }

    muted = !muted;
    applyMusicState();
    musicIcon.src = muted ? "music-off.svg" : "music-on.svg";
  });
}

document.addEventListener("visibilitychange", () => {
  if (!musicStarted || !music) return;

  if (document.hidden) {
    mutedByInactivity = !muted;
    applyMusicState();
    return;
  }

  if (!mutedByInactivity) return;

  mutedByInactivity = false;
  applyMusicState();
});

const rsvpForm = document.getElementById("rsvpForm");
const rsvpStatus = document.getElementById("rsvpStatus");
const rsvpSubmitButton = document.getElementById("rsvpSubmitButton");
const rsvpAttendeesInput = document.getElementById("rsvpAttendees");

if (rsvpForm && rsvpStatus && rsvpSubmitButton) {
  const setRsvpStatus = (message, isError = false) => {
    rsvpStatus.textContent = message;
    rsvpStatus.classList.toggle("is-error", isError);
  };

  const updateAttendeesState = () => {
    if (!rsvpAttendeesInput) return;

    const selectedAttendance = rsvpForm.querySelector("input[name='attendance']:checked");
    const isNotAttending = selectedAttendance && selectedAttendance.value === "no";

    rsvpAttendeesInput.disabled = Boolean(isNotAttending);
    rsvpAttendeesInput.required = !isNotAttending;

    if (isNotAttending) {
      rsvpAttendeesInput.value = "0";
    } else if (rsvpAttendeesInput.value === "0") {
      rsvpAttendeesInput.value = "";
    }
  };

  rsvpForm.querySelectorAll("input[name='attendance']").forEach((radio) => {
    radio.addEventListener("change", updateAttendeesState);
  });

  updateAttendeesState();

  rsvpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const webhookUrl = (rsvpForm.dataset.sheetWebhookUrl || "").trim();

    if (!webhookUrl) {
      setRsvpStatus("Sheet webhook URL is missing.", true);
      return;
    }

    const formData = new FormData(rsvpForm);
    const attendance = (formData.get("attendance") || "").toString();
    const name = (formData.get("name") || "").toString().trim();
    const attendees = attendance === "no"
      ? "0"
      : (formData.get("attendees") || "").toString().trim();

    if (!attendance || !name || !attendees) {
      setRsvpStatus("Please complete all RSVP fields.", true);
      return;
    }

    const attendeeCount = Number(attendees);
    if (!Number.isInteger(attendeeCount) || attendeeCount < 0) {
      setRsvpStatus("No. of Attendees must be a valid number.", true);
      return;
    }

    rsvpSubmitButton.disabled = true;
    rsvpSubmitButton.textContent = "Sending...";
    setRsvpStatus("Submitting your RSVP...");

    const payload = {
      timestamp: new Date().toISOString(),
      attendance,
      name,
      attendees: attendeeCount
    };

    try {
      await fetch(webhookUrl, {
        method: "POST",
        mode: "no-cors",
        headers: {
          "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify(payload)
      });

      setRsvpStatus("Thank you! Your RSVP has been submitted.");
      rsvpForm.reset();
      updateAttendeesState();
    } catch (error) {
      console.error("RSVP submit failed:", error);
      setRsvpStatus("Couldn't submit RSVP right now. Please try again.", true);
    } finally {
      rsvpSubmitButton.disabled = false;
      rsvpSubmitButton.textContent = "Send";
    }
  });
}
