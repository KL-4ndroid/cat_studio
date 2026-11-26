/* Fixed SVG material layers for the V2 prototype. Design geometry and colors come from StudioRender50. */
(function () {
  'use strict';

  const strengths = {
    soft: { shade: .26, light: .27, shine: .51, rim: .13, depth: 1.15, shadow: .15 },
    sculpted: { shade: .41, light: .35, shine: .70, rim: .22, depth: 1.85, shadow: .21 },
  };

  function fragment(svg, markup) {
    const group = document.createElementNS(svg.namespaceURI, 'g');
    group.innerHTML = markup;
    return group;
  }

  function apply(cat, prefix, strength = 'sculpted') {
    if (!Object.hasOwn(strengths, strength)) throw new Error('未知的材質預覽強度');
    const tone = strengths[strength];
    const paintedDesign = cat.querySelector('g[clip-path]');
    const art = paintedDesign.parentElement;
    const [base, , outline, previousNose, noseReflection] = art.children;
    const head = base.getAttribute('d');
    const clip = paintedDesign.getAttribute('clip-path');
    const id = name => prefix + '-mat-' + name;
    const ink = name => 'url(#' + id(name) + ')';

    // The legacy finish ends with four decorative paths after the entire drawing layer.
    if (art.hasAttribute('filter')) {
      [...paintedDesign.children].slice(-4).forEach(node => node.remove());
      art.removeAttribute('filter');
    }
    for (const child of [...cat.children]) {
      if (child !== art && child.localName !== 'defs') child.remove();
    }
    outline.remove();
    const noseTransform = previousNose.getAttribute('transform');
    previousNose.remove();
    noseReflection?.remove();

    const material = fragment(cat, `
      <defs>
        <radialGradient id="${id('shadow')}"><stop stop-color="#56473d" stop-opacity="${tone.shadow}"/><stop offset="1" stop-color="#56473d" stop-opacity="0"/></radialGradient>
        <linearGradient id="${id('metal')}" x2=".85" y2="1">
          <stop stop-color="#725028"/><stop offset=".25" stop-color="#edcc81"/><stop offset=".37" stop-color="#fff0ba"/>
          <stop offset=".53" stop-color="#a57939"/><stop offset=".76" stop-color="#e2bd70"/><stop offset="1" stop-color="#76522f"/>
        </linearGradient>
        <radialGradient id="${id('light')}" cx=".33" cy=".30" r=".71">
          <stop stop-color="#fff" stop-opacity="${tone.light}"/><stop offset=".55" stop-color="#fff" stop-opacity="${tone.light * .32}"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="${id('shade')}" cx=".43" cy=".35" r=".75">
          <stop offset=".38" stop-color="#302b30" stop-opacity="0"/><stop offset=".64" stop-color="#302b30" stop-opacity="${tone.shade * .36}"/>
          <stop offset="1" stop-color="#302b30" stop-opacity="${tone.shade}"/>
        </radialGradient>
        <linearGradient id="${id('rim')}" x2=".3" y2="1">
          <stop stop-color="#262126" stop-opacity="0"/><stop offset=".48" stop-color="#262126" stop-opacity="0"/><stop offset="1" stop-color="#262126" stop-opacity="${tone.rim}"/>
        </linearGradient>
        <radialGradient id="${id('gleam')}">
          <stop stop-color="#fff" stop-opacity="${tone.shine}"/><stop offset=".46" stop-color="#fff" stop-opacity="${tone.shine * .72}"/>
          <stop offset="1" stop-color="#fff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <ellipse cx="74" cy="108" rx="48" ry="11" fill="${ink('shadow')}"/>
      <ellipse cx="73" cy="27" rx="13" ry="5.3" fill="none" stroke="#74552f" stroke-width="3.8"/>
      <ellipse cx="73" cy="26.6" rx="13" ry="5.3" fill="none" stroke="${ink('metal')}" stroke-width="2.65"/>
      <path d="M66 94 C65 102 67 110 74 110 C81 110 85 104 84 96" fill="none" stroke="${ink('metal')}" stroke-width="2.6"/>
      <ellipse cx="76" cy="103.2" rx="8.1" ry="4.3" fill="${ink('metal')}" stroke="#876033" stroke-width=".5"/>
      <path d="${head}" transform="translate(.35 ${tone.depth})" fill="#433b37" opacity="${tone.shade * .56}"/>
    `);
    cat.insertBefore(material, art);

    const finish = fragment(cat, `
      <g clip-path="${clip}" pointer-events="none">
        <path d="${head}" fill="${ink('light')}"/>
        <path d="${head}" fill="${ink('shade')}"/>
        <path d="${head}" fill="none" stroke="${ink('rim')}" stroke-width="3.2"/>
        <ellipse cx="46" cy="43" rx="4.5" ry="9.5" transform="rotate(27 46 43)" fill="${ink('gleam')}"/>
        <ellipse cx="43.6" cy="48.5" rx="1.25" ry="3.3" transform="rotate(23 43.6 48.5)" fill="${ink('gleam')}"/>
        <ellipse cx="98" cy="80" rx="2.6" ry="6.1" transform="rotate(35 98 80)" fill="${ink('gleam')}" opacity=".35"/>
      </g>
      <g pointer-events="none">
        <ellipse cx="70.55" cy="68.35" rx="5.2" ry="3.4" fill="#423127" opacity=".25"/>
        <path d="M65.2 66.1 C65.4 63.1 74.6 63 74.8 66.1 C74.9 68.1 71.6 70.2 70 70.2 C68.4 70.2 65.1 68.1 65.2 66.1Z"
              fill="${ink('metal')}" stroke="#835b32" stroke-width=".42"/>
        <path d="M66.6 65.9 Q68.9 64.4 71.1 65" fill="none" stroke="#fff5cd" stroke-width=".85" stroke-linecap="round" opacity=".92"/>
      </g>
    `);
    if (noseTransform) finish.lastElementChild.setAttribute('transform', noseTransform);
    art.append(finish);
  }

  function render(renderer, ear, strength, prefix) {
    const svg = renderer.render(ear, 'flat', '', -1, prefix);
    svg.setAttribute('viewBox', '17 9 106 113');
    svg.setAttribute('aria-label', ear === 'left' ? '左耳冷琺瑯成品預覽' : '右耳冷琺瑯成品預覽');
    apply(svg.lastElementChild, prefix, strength);
    return svg;
  }

  window.CatMaterialV2 = { apply, render };
})();
