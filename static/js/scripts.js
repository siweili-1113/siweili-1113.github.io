const content_dir = 'contents/'
const config_file = 'config.yml'
const section_names = ['home', 'publications', 'experience', 'awards'];

// ============================================================
// 1. Synthwave BGM — 程序化合成, 无外部音频文件
// ============================================================
class SynthwaveBGM {
    constructor() {
        this.ctx = null;
        this.master = null;
        this.playing = false;
        this.scheduledUntil = 0;
        this.timer = null;
        this.tempo = 90; // BPM
        this.step = 0;
        // Cmin 和弦进行 (synthwave 经典): Cm - Ab - Eb - Bb
        this.chords = [
            [261.63, 311.13, 392.00], // C-Eb-G
            [207.65, 261.63, 311.13], // Ab-C-Eb
            [155.56, 196.00, 233.08], // Eb-G-Bb
            [233.08, 293.66, 349.23], // Bb-D-F
        ];
        // bass line (根音)
        this.bass = [65.41, 51.91, 38.89, 58.27]; // C2 Ab1 Eb1 Bb1
    }

    ensureCtx() {
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.master = this.ctx.createGain();
            this.master.gain.value = 0.18;
            // 简易混响: delay + feedback
            const delay = this.ctx.createDelay(1.0);
            delay.delayTime.value = 0.28;
            const fb = this.ctx.createGain();
            fb.gain.value = 0.32;
            const wet = this.ctx.createGain();
            wet.gain.value = 0.35;
            delay.connect(fb); fb.connect(delay); delay.connect(wet);
            wet.connect(this.master);
            this.fxIn = delay;
            this.master.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    playPad(freq, t, dur) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = freq;
        const filt = this.ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = 800;
        filt.Q.value = 6;
        // LFO 调滤波器 (synthwave 漂移感)
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.18;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 400;
        lfo.connect(lfoGain); lfoGain.connect(filt.frequency);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.12, t + 0.05);
        g.gain.linearRampToValueAtTime(0.08, t + dur - 0.1);
        g.gain.linearRampToValueAtTime(0, t + dur);
        o.connect(filt); filt.connect(g);
        g.connect(this.master);
        g.connect(this.fxIn);
        o.start(t); lfo.start(t);
        o.stop(t + dur); lfo.stop(t + dur);
    }

    playBass(freq, t, dur) {
        const o = this.ctx.createOscillator();
        o.type = 'triangle';
        o.frequency.value = freq;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.22, t + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + dur);
    }

    playKick(t) {
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(120, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.4, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        o.connect(g); g.connect(this.master);
        o.start(t); o.stop(t + 0.2);
    }

    scheduleAhead() {
        const beatDur = 60 / this.tempo / 2; // 8 分音符
        while (this.scheduledUntil < this.ctx.currentTime + 0.5) {
            const chordIdx = Math.floor(this.step / 8) % this.chords.length;
            // 每拍 kick
            if (this.step % 2 === 0) this.playKick(this.scheduledUntil);
            // 每和弦开头一拍 pad
            if (this.step % 8 === 0) {
                this.chords[chordIdx].forEach(f => this.playPad(f, this.scheduledUntil, beatDur * 8));
                this.playBass(this.bass[chordIdx], this.scheduledUntil, beatDur * 8);
            }
            this.scheduledUntil += beatDur;
            this.step++;
        }
    }

    start() {
        this.ensureCtx();
        if (this.playing) return;
        this.playing = true;
        this.scheduledUntil = this.ctx.currentTime + 0.05;
        this.step = 0;
        this.scheduleAhead();
        this.timer = setInterval(() => this.scheduleAhead(), 100);
    }

    stop() {
        this.playing = false;
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.master) {
            this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.2);
            setTimeout(() => {
                if (this.master) this.master.gain.value = 0.18;
            }, 250);
        }
    }

    toggle() {
        if (this.playing) { this.stop(); return false; }
        this.start();
        return true;
    }
}

// ============================================================
// 2. Theme Manager — 多主题切换 + localStorage
// ============================================================
const THEMES = ['neo', 'neo-dark', 'glass', 'swiss', 'bento', 'vaporwave'];

class ThemeManager {
    constructor() {
        this.body = document.body;
        this.menu = document.getElementById('themeMenu');
        this.toggleBtn = document.getElementById('themeToggle');
        const saved = localStorage.getItem('neo-theme');
        this.current = THEMES.includes(saved) ? saved : 'neo';
        this.apply(this.current);
        this.bind();
    }
    apply(name) {
        if (!THEMES.includes(name)) name = 'neo';
        this.current = name;
        this.body.setAttribute('data-theme', name);
        localStorage.setItem('neo-theme', name);
        // 同步菜单激活态
        if (this.menu) {
            this.menu.querySelectorAll('.theme-opt').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === name);
            });
        }
        // THEME 按钮激活态 (暗色/特殊主题高亮)
        if (this.toggleBtn) {
            this.toggleBtn.classList.toggle('active', name === 'neo-dark' || name === 'vaporwave');
        }
    }
    cycle() {
        const idx = THEMES.indexOf(this.current);
        this.apply(THEMES[(idx + 1) % THEMES.length]);
    }
    openMenu() {
        if (!this.menu) return;
        this.menu.hidden = false;
        this.toggleBtn.setAttribute('aria-expanded', 'true');
    }
    closeMenu() {
        if (!this.menu) return;
        this.menu.hidden = true;
        this.toggleBtn.setAttribute('aria-expanded', 'false');
    }
    toggleMenu() {
        this.menu.hidden ? this.openMenu() : this.closeMenu();
    }
    bind() {
        if (!this.toggleBtn || !this.menu) return;  // 容错: 子页面无控制面板时跳过
        this.toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu();
        });
        this.menu.addEventListener('click', (e) => {
            const opt = e.target.closest('.theme-opt');
            if (!opt) return;
            this.apply(opt.dataset.theme);
            this.closeMenu();
        });
        document.addEventListener('click', (e) => {
            if (!this.menu.hidden && !e.target.closest('.theme-picker')) {
                this.closeMenu();
            }
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.menu.hidden) this.closeMenu();
        });
    }
}

// ============================================================
// 3. 3D Tilt — 论文卡 hover 倾斜
// ============================================================
class TiltCards {
    constructor(selector) {
        this.maxTilt = 12;
        document.querySelectorAll(selector).forEach(el => {
            if (el.dataset.tiltInit) return;
            el.dataset.tiltInit = '1';
            el.classList.add('tilt-card');
            // 包裹内容, 不破坏原 HTML 结构
            el.addEventListener('mousemove', (e) => {
                const r = el.getBoundingClientRect();
                const px = (e.clientX - r.left) / r.width - 0.5;
                const py = (e.clientY - r.top) / r.height - 0.5;
                const rx = (-py * this.maxTilt).toFixed(2);
                const ry = (px * this.maxTilt).toFixed(2);
                el.style.transform = `perspective(700px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)`;
            });
            el.addEventListener('mouseleave', () => {
                el.style.transform = '';
            });
        });
    }
}

// ============================================================
// 4. Command Palette — Cmd+K 快速跳转
// ============================================================
class CommandPalette {
    constructor() {
        this.overlay = document.getElementById('cmdPalette');
        this.input = document.getElementById('cmdInput');
        this.results = document.getElementById('cmdResults');
        this.activeIdx = 0;
        this.commands = [
            { id: 'home',         label: 'HOME',         desc: '跳转到首页', action: () => this.scrollTo('#home') },
            { id: 'publications', label: 'PUBLICATIONS', desc: '跳转到论文', action: () => this.scrollTo('#publications') },
            { id: 'experience',   label: 'EXPERIENCE',   desc: '跳转到经历', action: () => this.scrollTo('#experience') },
            { id: 'awards',       label: 'AWARDS',       desc: '跳转到奖项', action: () => this.scrollTo('#awards') },
            { id: 'top',          label: 'TOP',          desc: '回到顶部',   action: () => window.scrollTo({ top: 0, behavior: 'smooth' }) },
            { id: 'bgm',          label: 'TOGGLE BGM',   desc: '开关背景音乐', action: () => window.__bgm && window.__bgm.toggle() },
            { id: 'theme',        label: 'CYCLE THEME', desc: '循环切换到下一个主题', action: () => window.__theme && window.__theme.cycle() },
            { id: 'github',       label: 'GITHUB',       desc: '打开 GitHub', action: () => { const a = document.getElementById('github-link'); if (a) window.open(a.href, '_blank'); } },
        ];
        this.bind();
    }
    bind() {
        if (!this.overlay || !this.input) return;  // 容错: 子页面无命令面板时跳过
        document.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault(); this.open();
            } else if (e.key === 'Escape' && !this.overlay.hidden) {
                this.close();
            }
        });
        const btn = document.getElementById('cmdPaletteBtn');
        if (btn) btn.addEventListener('click', () => this.open());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
        this.input.addEventListener('input', () => this.render());
        this.input.addEventListener('keydown', (e) => {
            const list = this.filter();
            if (e.key === 'ArrowDown') { e.preventDefault(); this.activeIdx = (this.activeIdx + 1) % list.length; this.render(); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); this.activeIdx = (this.activeIdx - 1 + list.length) % list.length; this.render(); }
            else if (e.key === 'Enter') { e.preventDefault(); list[this.activeIdx] && list[this.activeIdx].action(); this.close(); }
        });
    }
    filter() {
        const q = this.input.value.trim().toLowerCase();
        if (!q) return this.commands;
        return this.commands.filter(c =>
            c.id.includes(q) || c.label.toLowerCase().includes(q) || c.desc.includes(q));
    }
    render() {
        const list = this.filter();
        if (this.activeIdx >= list.length) this.activeIdx = 0;
        this.results.innerHTML = list.map((c, i) =>
            `<li class="${i === this.activeIdx ? 'active' : ''}" data-idx="${i}">
                ${c.label}<span class="cmd-desc">${c.desc}</span>
            </li>`).join('') || '<li style="opacity:0.5;cursor:default">无匹配命令</li>';
        this.results.querySelectorAll('li[data-idx]').forEach(li => {
            li.addEventListener('click', () => {
                const c = list[parseInt(li.dataset.idx)];
                if (c) { c.action(); this.close(); }
            });
            li.addEventListener('mouseenter', () => {
                this.activeIdx = parseInt(li.dataset.idx); this.render();
            });
        });
    }
    scrollTo(sel) {
        const el = document.querySelector(sel);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        } else {
            // 子页面没有该 section, 跳回主页对应锚点
            window.location.href = 'index.html' + sel;
        }
    }
    open() {
        this.overlay.hidden = false;
        this.input.value = '';
        this.activeIdx = 0;
        this.render();
        setTimeout(() => this.input.focus(), 30);
    }
    close() {
        this.overlay.hidden = true;
        this.input.blur();
    }
}

// Neo-Brutalist Custom Cursor
class NeoCursor {
    constructor() {
        this.cursor = document.querySelector('.custom-cursor');
        this.init();
    }

    init() {
        document.addEventListener('mousemove', (e) => {
            if (this.cursor) {
                this.cursor.style.left = e.clientX + 'px';
                this.cursor.style.top = e.clientY + 'px';
            }
        });

        document.addEventListener('mousedown', () => {
            if (this.cursor) this.cursor.style.transform = 'translate(-50%, -50%) rotate(45deg) scale(0.8)';
        });

        document.addEventListener('mouseup', () => {
            if (this.cursor) this.cursor.style.transform = 'translate(-50%, -50%) rotate(45deg) scale(1)';
        });

        // Hover effect for links and buttons
        const hoverables = 'a, button, .nav-link, #avatar img';
        document.addEventListener('mouseover', (e) => {
            if (e.target.closest(hoverables)) {
                if (this.cursor) this.cursor.classList.add('hover');
            }
        });

        document.addEventListener('mouseout', (e) => {
            if (e.target.closest(hoverables)) {
                if (this.cursor) this.cursor.classList.remove('hover');
            }
        });
    }
}

// Typewriter Effect
class Typewriter {
    constructor(element, text, speed = 100) {
        this.element = element;
        this.text = text;
        this.speed = speed;
        this.currentIndex = 0;
        this.isTyping = false;
    }

    start() {
        if (this.isTyping) return;
        this.isTyping = true;
        this.element.textContent = '';
        this.type();
    }

    type() {
        if (this.currentIndex < this.text.length) {
            this.element.textContent += this.text.charAt(this.currentIndex);
            this.currentIndex++;
            setTimeout(() => this.type(), this.speed);
        } else {
            this.isTyping = false;
        }
    }
}

window.addEventListener('DOMContentLoaded', event => {

    // Initialize Neo-Brutalist Cursor
    new NeoCursor();

    // Initialize new features
    const bgm = new SynthwaveBGM();
    const themeMgr = new ThemeManager();
    window.__bgm = bgm;
    window.__theme = themeMgr;
    new CommandPalette();

    const bgmBtn = document.getElementById('bgmToggle');
    if (bgmBtn) {
        bgmBtn.addEventListener('click', () => {
            const playing = bgm.toggle();
            bgmBtn.classList.toggle('active', playing);
        });
    }

    // After content loads, set data-text for glitch + init tilt on publication cards
    function enhanceContent() {
        document.querySelectorAll('.gradient-text').forEach(el => {
            el.setAttribute('data-text', el.textContent.trim());
        });
        // Apply tilt to publications list items (paper cards)
        new TiltCards('#publications .main-body ul li');
    }

    // Determine Page Type by element presence instead of URL string
    const detailContentEl = document.getElementById('detail-content');
    const isDetailPage = !!detailContentEl;

    // Activate Bootstrap scrollspy (only on home)
    if (!isDetailPage) {
        const mainNav = document.body.querySelector('#mainNav');
        if (mainNav) {
            new bootstrap.ScrollSpy(document.body, {
                target: '#mainNav',
                offset: 100,
            });
        };
    }

    // Navbar Toggler
    const navbarToggler = document.body.querySelector('.navbar-toggler');
    const responsiveNavItems = [].slice.call(
        document.querySelectorAll('#navbarResponsive .nav-link')
    );
    responsiveNavItems.map(function (responsiveNavItem) {
        responsiveNavItem.addEventListener('click', () => {
            if (window.getComputedStyle(navbarToggler).display !== 'none') {
                navbarToggler.click();
            }
        });
    });

    // Load Config (Yaml) - Global for both pages
    fetch(content_dir + config_file, {cache: 'no-cache'})
        .then(response => {
            if (!response.ok) throw new Error('Config file not found');
            return response.text();
        })
        .then(text => {
            const yml = jsyaml.load(text);
            Object.keys(yml).forEach(key => {
                try {
                    const element = document.getElementById(key);
                    if (element) {
                        if (key.endsWith('-link')) {
                            element.href = yml[key];
                        } else {
                            element.innerHTML = yml[key];
                        }
                        
                        // Hero Title Typewriter (Home only)
                        if (key === 'top-section-bg-text' && !isDetailPage) {
                            const typewriter = new Typewriter(element, yml[key], 100);
                            setTimeout(() => typewriter.start(), 500);
                        }
                    }
                } catch (err) {
                    console.log("Error loading key: " + key, err)
                }
            })
            // Set data-text on gradient-text titles for glitch effect
            document.querySelectorAll('.gradient-text').forEach(el => {
                el.setAttribute('data-text', el.textContent.trim());
            });
        })
        .catch(error => console.error("Config load error:", error));

    if (isDetailPage) {
        // Detail Page Logic
        const urlParams = new URLSearchParams(window.location.search);
        const contentId = urlParams.get('id');
        
        if (contentId) {
            const mdPath = `${content_dir}details/${contentId}.md`;
            console.log("Fetching detail content from:", mdPath);

            fetch(mdPath)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.text();
                })
                .then(markdown => {
                    marked.use({ mangle: false, headerIds: false });
                    const html = marked.parse(markdown);
                    const headerEl = document.getElementById('detail-header');
                    const titleEl = document.getElementById('detail-title');

                    // Extract first H1 as title
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = html;
                    const h1 = tempDiv.querySelector('h1');
                    
                    if (h1) {
                        const titleText = h1.textContent;
                        if (headerEl) headerEl.textContent = titleText;
                        if (titleEl) titleEl.textContent = titleText;
                        h1.remove(); 
                        detailContentEl.innerHTML = tempDiv.innerHTML;
                    } else {
                        detailContentEl.innerHTML = html;
                    }

                    // Pop-in effect
                    const detailSection = document.getElementById('detail-section');
                    if (detailSection) {
                        detailSection.style.opacity = '0';
                        detailSection.style.transform = 'translateY(20px)';
                        setTimeout(() => {
                            detailSection.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                            detailSection.style.opacity = '1';
                            detailSection.style.transform = 'translateY(0)';
                        }, 200);
                    }

                    if (window.MathJax) {
                        if (typeof MathJax.typeset === 'function') {
                            MathJax.typeset();
                        } else if (typeof MathJax.typesetPromise === 'function') {
                            MathJax.typesetPromise();
                        }
                    }
                    enhanceContent();
                })
                .catch(err => {
                    console.error("Content load error:", err);
                    detailContentEl.innerHTML = `
                        <div class="alert alert-danger border-4 border-dark shadow-sm rounded-0">
                            <h3>⚠️ Content Load Failed!</h3>
                            <p>Error details: <strong>${err.message}</strong></p>
                            <p>Path tried: <code>${mdPath}</code></p>
                            <a href="index.html" class="btn btn-dark mt-3 rounded-0 border-2">Back to Home</a>
                            <button onclick="location.reload()" class="btn btn-outline-dark mt-3 rounded-0 border-2 ms-2">Retry</button>
                        </div>`;
                });
        } else {
            detailContentEl.innerHTML = `<h3>No ID provided!</h3><a href="index.html">Back to Home</a>`;
        }
    } else {
        // Main Page Logic
        marked.use({ mangle: false, headerIds: false })
        section_names.forEach((name, idx) => {
            fetch(content_dir + name + '.md')
                .then(response => {
                    if (!response.ok) throw new Error(`${name}.md not found`);
                    return response.text();
                })
                .then(markdown => {
                    const html = marked.parse(markdown);
                    const element = document.getElementById(name + '-md');
                    if (element) {
                        element.innerHTML = html;
                        // Pop-in effect
                        const section = element.closest('section');
                        if (section) {
                            section.style.opacity = '0';
                            section.style.transform = 'translateY(20px)';
                            setTimeout(() => {
                                section.style.transition = 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
                                section.style.opacity = '1';
                                section.style.transform = 'translateY(0)';
                            }, idx * 150 + 500);
                        }
                    }
                }).then(() => {
                    if (window.MathJax) {
                        if (typeof MathJax.typeset === 'function') {
                            MathJax.typeset();
                        } else if (typeof MathJax.typesetPromise === 'function') {
                            MathJax.typesetPromise();
                        }
                    }
                    enhanceContent();
                })
                .catch(error => console.error(`Section ${name} load error:`, error));
        });
    }

    // Brutalist Progress Bar
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 0%;
        height: 8px;
        background: var(--accent-pink);
        z-index: 10002;
        border-bottom: 2px solid #000;
        transition: width 0.1s linear;
    `;
    document.body.appendChild(progressBar);

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrollPercent = (scrollTop / docHeight) * 100;
        progressBar.style.width = scrollPercent + '%';
    });
});
