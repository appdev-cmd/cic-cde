const drawings = [
  <g key="tower">
    <path className="project-art-fill" d="M106 105V53l45-25 57 22v52l-45 24zM106 53l57 23 45-26m-45 26v50" />
    <path d="M133 64V31l36-20 30 11v34m-66-25 30 11 36-20m-36 20v34M106 65l57 23 45-26m-102 16 57 23 45-26m-102 16 57 23 45-26M119 59v51m15-45v51m14-45v51m30-54v50m15-59v51" />
    <path className="project-art-datum" d="m98 107 67 26 52-29M100 51l52-29m59 20 11 5v53m-9-58v9m6 47h7M149 18v10" />
  </g>,
  <g key="bridge">
    <path className="project-art-fill" d="m72 102 146-38 12 6L83 111zM129 49l8-2v48l-8 2zm47-13 8-2v48l-8 2z" />
    <path d="m75 96 58-49 48 23 42-8m-120 26 30-41 31 27m-43 9 12-36 14 32m33-43-44 42m44-42-27 37m27-37-13 34m13-34 36 29m-36-29 21 33m-21-33 10 36" />
    <path className="project-art-datum" d="m67 115 166-45M130 39V26m51 3V16m-56 13 62-16m-68 96h79m-64-7v15m48-23v23" />
  </g>,
  <g key="atrium">
    <path className="project-art-fill" d="M90 100V62l64-30 65 24v42l-65 29zM90 62l64 23 65-29m-65 29v42" />
    <path d="m106 68 48-22 48 18M106 68v39m16-33v40m16-34v40m32-43v43m16-50v43m16-50v43M90 75l64 23 65-29M90 87l64 24 65-29m-93-6 16-14 27-12m-9 32 26-24" />
    <path className="project-art-datum" d="m83 58 71-34 73 27m-73-32v12m-73 77 73 27 73-32m-4-47h12m-7 0v41m-5 0h12" />
  </g>,
  <g key="roof">
    <path className="project-art-fill" d="M85 96V66l33-33 38 13 29-17 36 16v41l-66 34zM85 66l70 27 66-48m-66 48v27" />
    <path d="m118 33 37 60m1-47 65-1m-65 1 29 25m-85 1v30m18-23v30m19-23v29m36-35v31m18-44v34m17-46v37M85 81l70 26 66-40" />
    <path className="project-art-datum" d="m76 98 79 31 75-38m-46-69v10m-69-7v12m-21 70 38 15m69-12 25-13" />
  </g>,
  <g key="terraces">
    <path className="project-art-fill" d="M87 101V80l44-22v-9l43-22 49 19v50l-65 32zM87 80l71 26 65-31m-65 31v22m-27-79 52 19 40-22m-40 22v27" />
    <path d="m87 90 71 27 65-32m-118 2v22m18-15v22m18-16v22m5-68v16m17-10v16m36-17v28m13-35v29m-81-21 52 19" />
    <path className="project-art-datum" d="m78 103 79 33 74-36m-59-80v10m-48 15 49-24 58 21m-5-4v10" />
  </g>,
  <g key="canopy">
    <path className="project-art-fill" d="M82 77q37-43 69-37 31-24 68 11l-62 40z" />
    <path d="M92 79v30m35-22v35m30-31v39m31-58v36m23-50v37M82 77l75 14 62-40M92 109l65 21 54-35m-60-55 6 51m-36-45 36 45m25-57-25 57m-65 9 65 22 54-36" />
    <path className="project-art-datum" d="m77 113 81 25 66-42m-5-45 11-7m-4-4 8 9M79 70l47-32" />
  </g>,
  <g key="twin-towers">
    <path className="project-art-fill" d="M96 96V53l32-16 23 10v44l-32 17zM153 99V40l36-20 27 12v62l-36 20zM96 53l23 10 32-16m-32 16v45m34-68 27 10 36-18m-36 18v64" />
    <path d="m96 67 23 10 32-16m-55 20 23 10 32-16m2-21 27 10 36-19m-63 23 27 10 36-19m-63 24 27 10 36-20m-18-30v59m-92-45v43" />
    <path className="project-art-datum" d="m86 99 86 31 53-30m-109 15 52 19m59-96v55m-4-56 9 2m-9 53 9 2" />
  </g>,
  <g key="truss">
    <path className="project-art-fill" d="M79 84V62l67-35 76 26v36l-65 36zM79 62l78 28 65-37m-65 37v35" />
    <path d="m79 73 78 29 65-37m-65 25-22 4-19-23-20 11-17-20m78 28 18 3 14-22 15 6 18-24M100 80v15m19-8v18m19-10v19m38-22v23m19-34v23m15-34v24" />
    <path className="project-art-datum" d="m71 88 86 45 74-41M76 56l69-36 81 27m-81-32v12m78 21 9 4" />
  </g>,
];

export default function ProjectArtwork({ index }: { index: number }) {
  return (
    <div className="project-art" data-tone={index % 8} aria-hidden="true">
      <svg viewBox="0 0 300 144" preserveAspectRatio="xMidYMid slice" focusable="false">
        <path className="project-art-marks" d="M18 28v-9h9m246 0h9v9m0 88v9h-9m-246 0h-9v-9M33 72h14m206 0h14M150 8v8m0 112v8" />
        {drawings[index % drawings.length]}
      </svg>
    </div>
  );
}
