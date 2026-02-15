import { Plugin } from 'obsidian';

export default class FloatHighlightsPlugin extends Plugin {
	onload() {
		console.log("loading plugin");

		const highlightObserver = new IntersectionObserver((entries) => {
			entries.forEach((entry) => {
				if (entry.isIntersecting) {
					entry.target.parentElement?.classList.add("float-highlights");
				} else {
					entry.target.parentElement?.classList.remove("float-highlights");
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
