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
	private domObserver: MutationObserver | null = null;
	private scrollIdleTimer: number | null = null;
	private observedTargets = new Set<HTMLElement>();
	private observedTargetMeta = new WeakMap<HTMLElement, { insideHighlight: boolean }>();
	private observedTargetTags = new WeakMap<HTMLElement, Set<SupportedTag>>();
	private activeCount = 0;
	private intersectingTargets = new Set<HTMLElement>();
	private activeContributionByTarget = new WeakMap<HTMLElement, Map<SupportedTag, HTMLElement>>();
	private activeTagsByContainer = new WeakMap<HTMLElement, Record<SupportedTag, number>>();

	async onload() {
		await this.loadSettings();
		this.applyStyles();
		this.addSettingTab(new FloatHighlightsSettingTab(this.app, this));

		const setScrollActive = () => {
			document.body.classList.add('float-scroll-active');
			if (this.scrollIdleTimer !== null) {
				window.clearTimeout(this.scrollIdleTimer);
			}
			this.scrollIdleTimer = window.setTimeout(() => {
				document.body.classList.remove('float-scroll-active');
				this.observeInActivePreviewRoots();
				this.scrollIdleTimer = null;
			}, 120);
		};

		// Obsidian scrolls inside pane containers, not always on window.
		this.registerDomEvent(window, 'scroll', setScrollActive, { passive: true });
		this.registerDomEvent(document, 'scroll', setScrollActive, { passive: true, capture: true });

		this.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const target = entry.target as HTMLElement;
				const tags = this.observedTargetTags.get(target);
				if (!tags || tags.size === 0) return;

				if (entry.isIntersecting) {
					if (this.intersectingTargets.has(target)) return;
					this.intersectingTargets.add(target);
					tags.forEach((tag) => this.applyTargetTagContribution(target, tag));
				} else {
					if (!this.intersectingTargets.has(target)) return;
					this.intersectingTargets.delete(target);
					tags.forEach((tag) => this.removeTargetTagContribution(target, tag));
				}
			});
		}, { threshold: 0.01 });

		this.registerMarkdownPostProcessor((element) => {
			this.observeInElement(element);
		});
		this.observeInActivePreviewRoots();
		this.startDomObserver();
	}

	onunload() {
		this.observer?.disconnect();
		this.domObserver?.disconnect();
		this.domObserver = null;
		this.observedTargets.clear();
		this.resetActiveHighlightState();
		if (this.scrollIdleTimer !== null) {
			window.clearTimeout(this.scrollIdleTimer);
			this.scrollIdleTimer = null;
		}
		document.body.classList.remove('float-scroll-active');
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

	refreshObservedHighlights() {
		if (!this.observer) return;
		this.observer.disconnect();
		this.observedTargets.clear();
		this.observedTargetMeta = new WeakMap<HTMLElement, { insideHighlight: boolean }>();
		this.observedTargetTags = new WeakMap<HTMLElement, Set<SupportedTag>>();
		this.resetActiveHighlightState();
		this.observeInActivePreviewRoots();
	}

	private applyStyles(): void {
		const body = document.body;
		body.style.setProperty('--float-mark-scale', this.settings.mark.scaleAmount.toString());
		body.style.setProperty('--float-strong-scale', this.settings.strong.scaleAmount.toString());
		body.style.setProperty('--float-em-scale', this.settings.em.scaleAmount.toString());
		body.style.setProperty('--float-duration', `${this.settings.animationDuration}ms`);
		body.style.setProperty('--float-bg-opacity', this.settings.backgroundOpacity.toString());
	}

	private observeInElement(root: Element): void {
		this.observeTagInRoot(root, 'mark');
		this.observeTagInRoot(root, 'strong');
		this.observeTagInRoot(root, 'em');
	}

	private observeInActivePreviewRoots(): void {
		const roots = this.getActivePreviewRoots();
		roots.forEach((root) => this.observeInElement(root));
	}

	private startDomObserver(): void {
		this.domObserver?.disconnect();
		this.domObserver = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.addedNodes.length === 0) continue;
				mutation.addedNodes.forEach((node) => {
					if (!(node instanceof Element)) return;
					if (!node.closest('.markdown-preview-sizer, .markdown-preview-view, .markdown-rendered')
						&& !node.matches('.markdown-preview-sizer, .markdown-preview-view, .markdown-rendered')) {
						return;
					}
					if (node.matches('mark, strong, em')
						|| node.querySelector('mark, strong, em')
						|| node.matches('.markdown-preview-sizer, .markdown-preview-view, .markdown-rendered')) {
						this.observeInElement(node);
					}
				});
			}
		});

		this.domObserver.observe(document.body, { childList: true, subtree: true });
	}

	private getActivePreviewRoots(): Element[] {
		const previewSizers = Array.from(document.querySelectorAll('.markdown-preview-sizer'));
		if (previewSizers.length > 0) return previewSizers;
		return Array.from(document.querySelectorAll('.markdown-preview-view, .markdown-rendered'));
	}

	private observeTagInRoot(root: Element, tag: SupportedTag): void {
		root.querySelectorAll(tag).forEach((el) => {
			const htmlEl = el as HTMLElement;
			this.registerObservedTarget(htmlEl, tag);
		});
	}

	private resetActiveHighlightState(): void {
		this.activeCount = 0;
		this.intersectingTargets.clear();
		this.activeContributionByTarget = new WeakMap<HTMLElement, Map<SupportedTag, HTMLElement>>();
		this.activeTagsByContainer = new WeakMap<HTMLElement, Record<SupportedTag, number>>();
		document.body.classList.remove('float-highlights-active');
		document.querySelectorAll('.float-highlights').forEach((el) => {
			const htmlEl = el as HTMLElement;
			htmlEl.classList.remove('float-highlights');
			delete htmlEl.dataset.floatTag;
		});
	}

	private incrementContainerTag(container: HTMLElement, tag: SupportedTag): void {
		const counts = this.activeTagsByContainer.get(container) ?? { mark: 0, strong: 0, em: 0 };
		counts[tag] += 1;
		this.activeTagsByContainer.set(container, counts);
		this.applyContainerTagState(container, counts);
	}

	private decrementContainerTag(container: HTMLElement, tag: SupportedTag): void {
		const counts = this.activeTagsByContainer.get(container);
		if (!counts) return;
		counts[tag] = Math.max(0, counts[tag] - 1);
		this.applyContainerTagState(container, counts);
	}

	private applyContainerTagState(container: HTMLElement, counts: Record<SupportedTag, number>): void {
		const preferredTag = SUPPORTED_TAGS.find((tag) => counts[tag] > 0);
		if (!preferredTag) {
			if (!container.classList.contains('float-highlights')) return;
			container.classList.remove('float-highlights');
			delete container.dataset.floatTag;
			this.activeCount = Math.max(0, this.activeCount - 1);
			if (this.activeCount === 0) document.body.classList.remove('float-highlights-active');
			return;
		}

		if (!container.classList.contains('float-highlights')) {
			container.classList.add('float-highlights');
			this.activeCount++;
			if (this.activeCount === 1) document.body.classList.add('float-highlights-active');
		}
		container.dataset.floatTag = preferredTag;
	}

	private registerObservedTarget(target: HTMLElement, tag: SupportedTag): void {
			const insideHighlight = tag !== 'mark' && !!target.closest('mark');
			this.observedTargetMeta.set(target, { insideHighlight });
		const existingTags = this.observedTargetTags.get(target);
		if (existingTags) {
			if (existingTags.has(tag)) return;
			existingTags.add(tag);
			// If target is already intersecting, apply newly added tag immediately.
			if (this.intersectingTargets.has(target)) {
				this.applyTargetTagContribution(target, tag);
			}
			return;
		}

		this.observedTargetTags.set(target, new Set<SupportedTag>([tag]));
		if (!this.observedTargets.has(target)) {
			this.observedTargets.add(target);
			this.observer.observe(target);
		}
	}

	private applyTargetTagContribution(target: HTMLElement, tag: SupportedTag): void {
		if (!this.isTagEnabledForTarget(target, tag)) return;
		const animateTarget = this.getAnimateTarget(target);
		if (!animateTarget) return;

		const contributions = this.activeContributionByTarget.get(target) ?? new Map<SupportedTag, HTMLElement>();
		if (contributions.has(tag)) return;
		contributions.set(tag, animateTarget);
		this.activeContributionByTarget.set(target, contributions);
		this.incrementContainerTag(animateTarget, tag);
	}

	private removeTargetTagContribution(target: HTMLElement, tag: SupportedTag): void {
		const contributions = this.activeContributionByTarget.get(target);
		if (!contributions) return;
		const animateTarget = contributions.get(tag);
		if (!animateTarget) return;
		contributions.delete(tag);
		this.decrementContainerTag(animateTarget, tag);
	}

	private getAnimateTarget(target: HTMLElement): HTMLElement | null {
		return this.settings.animateWordOnly ? target : (getHighlightContainer(target) ?? target);
	}

	private isTagEnabledForTarget(target: HTMLElement, tag: SupportedTag): boolean {
		if (!this.settings[tag].enabled) return false;
		if (tag === 'mark') return true;
		const meta = this.observedTargetMeta.get(target);
		if (!meta) return false;
		if (!meta.insideHighlight) return true;
		return this.settings.animateInsideHighlight;
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
					this.plugin.refreshObservedHighlights();
				}));

		new Setting(containerEl)
			.setName('Animate bold/italic inside highlights')
			.setDesc('Also animate bold/italic text that is inside a ==highlight== block')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.animateInsideHighlight)
				.onChange(async (value) => {
					this.plugin.settings.animateInsideHighlight = value;
					await this.plugin.saveSettings();
					this.plugin.refreshObservedHighlights();
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
						this.plugin.refreshObservedHighlights();
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
