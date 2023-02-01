import { Plugin } from 'obsidian';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	//create a setting to enable or disable the plugin
	mySetting: boolean;
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	onload() {
		console.log("loading plugin");

		const highlightObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.parentElement?.classList.add("focus");
				} else {
					entry.target.parentElement?.classList.remove("focus");
				}
			});
		}, { threshold: 0.2 });

		this.registerMarkdownPostProcessor((element) => {
			const highlightElements = element.querySelectorAll("mark");
			if (highlightElements) {
				Array.from(highlightElements).forEach((el) => {
					highlightObserver.observe(el)
				});
			}
		});
	}

	onunload() {
		console.log("Unloading plugin")
	}
}