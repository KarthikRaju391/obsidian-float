import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';

type SupportedTag = 'mark' | 'strong' | 'em';
const SUPPORTED_TAGS: SupportedTag[] = ['mark', 'strong', 'em'];

interface TagSettings {
	enabled: boolean;
	scaleAmount: number;
}

interface FloatHighlightsSettings {
	mark: TagSettings;
	strong: TagSettings;
	em: TagSettings;
	animationDuration: number;
	animateWordOnly: boolean;
	animateInsideHighlight: boolean;
	backgroundOpacity: number;
}

const DEFAULT_SETTINGS: FloatHighlightsSettings = {
	mark: { enabled: true, scaleAmount: 1.1 },
	strong: { enabled: false, scaleAmount: 1.08 },
	em: { enabled: false, scaleAmount: 1.05 },
	animationDuration: 150,
	animateWordOnly: false,
	animateInsideHighlight: false,
	backgroundOpacity: 1.0,
};

function getHighlightContainer(el: HTMLElement): HTMLElement | null {
	return (el.closest('p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6') as HTMLElement | null) ?? el.parentElement;
}

export default class FloatHighlightsPlugin extends Plugin {
	settings: FloatHighlightsSettings;
	private observer: IntersectionObserver;
	private scrollIdleTimer: number | null = null;

	async onload() {
		await this.loadSettings();
		this.applyStyles();
		this.addSettingTab(new FloatHighlightsSettingTab(this.app, this));

		const observedContainers = new WeakSet<HTMLElement>();
		let activeCount = 0;
		const setScrollActive = () => {
			document.body.classList.add('float-scroll-active');
			if (this.scrollIdleTimer !== null) {
				window.clearTimeout(this.scrollIdleTimer);
			}
			this.scrollIdleTimer = window.setTimeout(() => {
				document.body.classList.remove('float-scroll-active');
				this.scrollIdleTimer = null;
			}, 120);
		};

		this.registerDomEvent(window, 'scroll', setScrollActive, { passive: true });

		this.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const target = entry.target as HTMLElement;
				const animateTarget = this.settings.animateWordOnly
					? target
					: getHighlightContainer(target) ?? target;
				const tag = target.tagName.toLowerCase();

				if (entry.isIntersecting) {
					if (animateTarget.dataset.floatTag === tag) return;
					animateTarget.classList.add("float-highlights");
					animateTarget.dataset.floatTag = tag;
					activeCount++;
					if (activeCount === 1) document.body.classList.add("float-highlights-active");
				} else {
					if (!animateTarget.classList.contains("float-highlights")) return;
					animateTarget.classList.remove("float-highlights");
					delete animateTarget.dataset.floatTag;
					activeCount = Math.max(0, activeCount - 1);
					if (activeCount === 0) document.body.classList.remove("float-highlights-active");
				}
			});
		}, { threshold: 0.2 });

		this.registerMarkdownPostProcessor((element) => {
			const enabledTags = SUPPORTED_TAGS.filter(tag => this.settings[tag].enabled);
			if (enabledTags.length === 0) return;

			const selector = enabledTags.join(", ");
			const matchedElements = element.querySelectorAll(selector);

			matchedElements.forEach((el) => {
				const htmlEl = el as HTMLElement;
				// Skip bold/italic inside a highlight unless explicitly enabled
				if (htmlEl.tagName !== 'MARK' && htmlEl.closest('mark') && !this.settings.animateInsideHighlight) {
					return;
				}
				const container = this.settings.animateWordOnly ? htmlEl : getHighlightContainer(htmlEl);
				if (container && !observedContainers.has(container)) {
					observedContainers.add(container);
					this.observer.observe(htmlEl);
				}
			});
		});
	}

	onunload() {
		this.observer?.disconnect();
		if (this.scrollIdleTimer !== null) {
			window.clearTimeout(this.scrollIdleTimer);
			this.scrollIdleTimer = null;
		}
		document.body.classList.remove('float-scroll-active');
		document.body.classList.remove('float-highlights-active');
	}

	async loadSettings() {
		const data = (await this.loadData()) || {};
		this.settings = {
			mark: { ...DEFAULT_SETTINGS.mark, ...data.mark },
			strong: { ...DEFAULT_SETTINGS.strong, ...data.strong },
			em: { ...DEFAULT_SETTINGS.em, ...data.em },
			animationDuration: data.animationDuration ?? DEFAULT_SETTINGS.animationDuration,
			animateWordOnly: data.animateWordOnly ?? DEFAULT_SETTINGS.animateWordOnly,
			animateInsideHighlight: data.animateInsideHighlight ?? DEFAULT_SETTINGS.animateInsideHighlight,
			backgroundOpacity: data.backgroundOpacity ?? DEFAULT_SETTINGS.backgroundOpacity,
		};
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.applyStyles();
	}

	private applyStyles(): void {
		const body = document.body;
		body.style.setProperty('--float-mark-scale', this.settings.mark.scaleAmount.toString());
		body.style.setProperty('--float-strong-scale', this.settings.strong.scaleAmount.toString());
		body.style.setProperty('--float-em-scale', this.settings.em.scaleAmount.toString());
		body.style.setProperty('--float-duration', `${this.settings.animationDuration}ms`);
		body.style.setProperty('--float-bg-opacity', this.settings.backgroundOpacity.toString());
	}
}

class FloatHighlightsSettingTab extends PluginSettingTab {
	plugin: FloatHighlightsPlugin;

	constructor(app: App, plugin: FloatHighlightsPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h3', { text: 'Global Settings' });

		new Setting(containerEl)
			.setName('Animation duration')
			.setDesc('Duration of the float animation in milliseconds')
			.addSlider(slider => slider
				.setLimits(50, 500, 10)
				.setValue(this.plugin.settings.animationDuration)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.animationDuration = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Background opacity')
			.setDesc('Opacity of non-highlighted content when highlights are active (1.0 = no dimming)')
			.addSlider(slider => slider
				.setLimits(0.1, 1.0, 0.05)
				.setValue(this.plugin.settings.backgroundOpacity)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.backgroundOpacity = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Animate word only')
			.setDesc('Animate only the highlighted word instead of the entire text block')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.animateWordOnly)
				.onChange(async (value) => {
					this.plugin.settings.animateWordOnly = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Animate bold/italic inside highlights')
			.setDesc('Also animate bold/italic text that is inside a ==highlight== block')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.animateInsideHighlight)
				.onChange(async (value) => {
					this.plugin.settings.animateInsideHighlight = value;
					await this.plugin.saveSettings();
				}));

		const tagLabels: Record<SupportedTag, { name: string; syntax: string }> = {
			mark: { name: 'Highlights', syntax: '==text==' },
			strong: { name: 'Bold', syntax: '**text**' },
			em: { name: 'Italic', syntax: '*text*' },
		};

		for (const tag of SUPPORTED_TAGS) {
			const label = tagLabels[tag];

			containerEl.createEl('h3', { text: `${label.name} (${label.syntax})` });

			new Setting(containerEl)
				.setName(`Enable ${label.name.toLowerCase()} float`)
				.setDesc(`Apply float animation to ${label.syntax} text`)
				.addToggle(toggle => toggle
					.setValue(this.plugin.settings[tag].enabled)
					.onChange(async (value) => {
						this.plugin.settings[tag].enabled = value;
						await this.plugin.saveSettings();
					}));

			new Setting(containerEl)
				.setName(`${label.name} scale amount`)
				.setDesc(`How much to scale ${label.syntax} blocks (1.0 = no scale)`)
				.addSlider(slider => slider
					.setLimits(1.0, 1.5, 0.01)
					.setValue(this.plugin.settings[tag].scaleAmount)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings[tag].scaleAmount = value;
						await this.plugin.saveSettings();
					}));
		}
	}
}
