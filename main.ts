import { Plugin, PluginSettingTab, App, Setting } from 'obsidian';

interface FloatHighlightsSettings {
	scaleAmount: number;
	animationDuration: number;
	animationType: 'scale' | 'fade' | 'bounce';
	enableNotes: boolean;
}

const DEFAULT_SETTINGS: FloatHighlightsSettings = {
	scaleAmount: 1.1,
	animationDuration: 150,
	animationType: 'scale',
	enableNotes: true
};

export default class FloatHighlightsPlugin extends Plugin {
	settings: FloatHighlightsSettings;

	async onload() {
		await this.loadSettings();
		
		this.addSettingTab(new FloatHighlightsSettingTab(this.app, this));

		// Register highlight click handler for notes
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			const target = evt.target as HTMLElement;
			if (target.tagName === 'MARK' && this.settings.enableNotes) {
				this.showNotePopup(target);
			}
		});

		const highlightObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					const parent = entry.target.parentElement;
					if (parent) {
						parent.classList.add("float-highlights");
						parent.setAttribute('data-animation', this.settings.animationType);
						parent.style.setProperty('--scale-amount', this.settings.scaleAmount.toString());
						parent.style.setProperty('--animation-duration', `${this.settings.animationDuration}ms`);
					}
				} else {
					entry.target.parentElement?.classList.remove("float-highlights");
				}
			});
		}, { threshold: 0 });

		this.registerMarkdownPostProcessor((element) => {
			const highlightElements = element.querySelectorAll("mark");
			if (highlightElements) {
				Array.from(highlightElements).forEach((el) => {
					// Add data attribute for storing notes
					el.setAttribute('data-note', '');
					highlightObserver.observe(el);
				});
			}
		});
	}

	private showNotePopup(highlight: HTMLElement) {
		const note = highlight.getAttribute('data-note') || '';
		const popup = document.createElement('div');
		popup.className = 'highlight-note-popup';
		
		const textarea = document.createElement('textarea');
		textarea.value = note;
		textarea.placeholder = 'Add a note to this highlight...';
		
		const saveButton = document.createElement('button');
		saveButton.textContent = 'Save';
		saveButton.onclick = () => {
			highlight.setAttribute('data-note', textarea.value);
			popup.remove();
		};

		popup.appendChild(textarea);
		popup.appendChild(saveButton);
		
		// Position popup near highlight
		const rect = highlight.getBoundingClientRect();
		popup.style.top = `${rect.bottom + 10}px`;
		popup.style.left = `${rect.left}px`;
		
		document.body.appendChild(popup);
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	onunload() {
		console.log("Unloading Float Highlights plugin");
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

		new Setting(containerEl)
			.setName('Scale amount')
			.setDesc('How much to scale the highlight (1.0 = no scale)')
			.addSlider(slider => slider
				.setLimits(1, 1.5, 0.05)
				.setValue(this.plugin.settings.scaleAmount)
				.onChange(async (value) => {
					this.plugin.settings.scaleAmount = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Animation duration')
			.setDesc('Duration of the animation in milliseconds')
			.addSlider(slider => slider
				.setLimits(50, 500, 10)
				.setValue(this.plugin.settings.animationDuration)
				.onChange(async (value) => {
					this.plugin.settings.animationDuration = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Animation type')
			.setDesc('Choose the type of animation')
			.addDropdown(dropdown => dropdown
				.addOption('scale', 'Scale')
				.addOption('fade', 'Fade')
				.addOption('bounce', 'Bounce')
				.setValue(this.plugin.settings.animationType)
				.onChange(async (value: 'scale' | 'fade' | 'bounce') => {
					this.plugin.settings.animationType = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Enable highlight notes')
			.setDesc('Allow adding notes to highlights')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableNotes)
				.onChange(async (value) => {
					this.plugin.settings.enableNotes = value;
					await this.plugin.saveSettings();
				}));
	}
}