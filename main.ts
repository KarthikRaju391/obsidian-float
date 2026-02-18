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
	padding: number;
}

const DEFAULT_SETTINGS: FloatHighlightsSettings = {
	mark: { enabled: true, scaleAmount: 1.1 },
	strong: { enabled: false, scaleAmount: 1.08 },
	em: { enabled: false, scaleAmount: 1.05 },
	animationDuration: 150,
	padding: 1.0,
};

function getHighlightContainer(el: HTMLElement): HTMLElement | null {
	return (el.closest('p, li, blockquote, td, th, h1, h2, h3, h4, h5, h6') as HTMLElement | null) ?? el.parentElement;
}

export default class FloatHighlightsPlugin extends Plugin {
	settings: FloatHighlightsSettings;
	private observer: IntersectionObserver;

	async onload() {
		await this.loadSettings();
		this.applyStyles();
		this.addSettingTab(new FloatHighlightsSettingTab(this.app, this));

		this.observer = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				const target = entry.target as HTMLElement;
				const container = getHighlightContainer(target);
				if (!container) return;

				if (entry.isIntersecting) {
					container.classList.add("float-highlights");
					container.setAttribute("data-float-tag", target.tagName.toLowerCase());
				} else {
					container.classList.remove("float-highlights");
					container.removeAttribute("data-float-tag");
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
				if (getHighlightContainer(htmlEl)) {
					this.observer.observe(htmlEl);
				}
			});
		});
	}

	onunload() {
		this.observer?.disconnect();
	}

	async loadSettings() {
		const data = (await this.loadData()) || {};
		this.settings = {
			mark: { ...DEFAULT_SETTINGS.mark, ...data.mark },
			strong: { ...DEFAULT_SETTINGS.strong, ...data.strong },
			em: { ...DEFAULT_SETTINGS.em, ...data.em },
			animationDuration: data.animationDuration ?? DEFAULT_SETTINGS.animationDuration,
			padding: data.padding ?? DEFAULT_SETTINGS.padding,
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
		body.style.setProperty('--float-padding', `${this.settings.padding}em`);
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
			.setName('Block padding')
			.setDesc('Padding around the animated block (in em units)')
			.addSlider(slider => slider
				.setLimits(0, 2, 0.1)
				.setValue(this.plugin.settings.padding)
				.setDynamicTooltip()
				.onChange(async (value) => {
					this.plugin.settings.padding = value;
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
