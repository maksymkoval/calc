/*global jQuery, $, ga, dataLayer, FastClick*/
'use strict';

var app = {
	device: {
		isMobile: navigator.userAgent.match(/Android/i)
			|| navigator.userAgent.match(/webOS/i)
			|| navigator.userAgent.match(/iPhone/i)
			|| navigator.userAgent.match(/iPad/i)
			|| navigator.userAgent.match(/iPod/i)
			|| navigator.userAgent.match(/BlackBerry/i)
			|| navigator.userAgent.match(/Windows Phone/i)
	},
	utils: {
		getScrollTop: function() {
			return $('html').scrollTop() || $('body').scrollTop() || $(window).scrollTop();
		},
		getOffset: function(elem) {
			return elem instanceof jQuery ? elem[0].getBoundingClientRect() : elem.getBoundingClientRect();
		}
	},
	layout: {
		init: function() {
			
		}
	},
	calculate: function(options) {
		options = options || {};
		
		var self = this;
		this.$elem = $('.calculate');
		this.$numbers = this.$elem.find('.numbers');
		this.$arrows = this.$elem.find('.arrows');
		this.$progressBar = this.$elem.find('.progress .bar');
		this.$form = this.$elem.find('form');
		this.$questions = this.$elem.find('ul.questions');
		this.$questionsList = this.$questions.children();
		this.$price = $('header .price span');
		this.priceAnimation = null;
		this.lastPrice = 0;
		this.price = 0;
		
		this.type = options.type || {};
		this.sections = options.sections || [];
		this.features = options.features || [];
		this.services = options.services || [];
		this.questions = options.questions || [];
		this.tracking = options.tracking || false;
		this.preview = options.preview || null;
		
		this.trackingUrl = options.trackingUrl || '';
		this.trackingQueue = [];
		this._tracking = false;
		
		this.active = options.active || 1;
		this.total = this.$questionsList.length;
		this.scrollY = 0;
		this.lastTouches = [];
		
		Object.defineProperties(this, {
			'$active': {
				get: function() {
					return this.$questionsList.eq(this.active-1);
				}
			}
		});
		
		this.setup = function() {
			//bind events
			this.$form.find('input').on('input change', function() {
				if ($(this).attr('type') !== 'text') {
					self.validateOption($(this).parents('.option'));
					self.updatePrice();
				} else {
					self.validateInput($(this));
				}
			}).filter('[type="text"]').trigger('change');
			
			this.$form.find("input[type=\"radio\"]").click(function() {
				if (!$(this).parents(".options-radio").length) {
					return;
				}
				
				if ($(this).data("checked")) {
					$(this).prop("checked", false);
				} else {
					$(this).data("checked", false);
				}

				$(this).data("checked", $(this).prop("checked"));
				
				self.validateOption($(this).parents('.option'));
				self.updatePrice();
			});
			
			this.$questions.find('.next a').click(function() {
				self.go(1);
				
				return false;
			});
			
			this.$arrows.find('.prev,.next').click(function() {
				self.go($(this).hasClass('prev') ? -1 : 1);
				
				return false;
			});
			
			this.$questionsList.eq(-1).find('.next a span').text('Submit');
			
			//bind keys
			$(document).on('keydown', function(e) {
				self.handleKey(e, e.keyCode);
			})
			.on('mousewheel touchmove', function(e) {
				self.handleWheel(e);
			})
			.on("touchstart", function(event) {
				self.lastTouches = event.originalEvent.touches[0];
			});
			
			$(window).on('resize', function() {
				self.updateTooltips();
			});
			
			this.updateTooltips();
			
			if (this.preview) {
				this.$questions.addClass('preview');
				
				var i;
				
				for (i = 0; i < this.preview.questions.length; i++) {
					this.$questionsList.filter('[data-id="' + this.preview.questions[i] + '"]').addClass('seen');
				}
				for (i = 0; i < this.preview.options.length; i++) {
					this.$questions.find('.option[data-id="' + this.preview.options[i] + '"] input').attr('checked', true).change();
				}
				
				this.$form.find('.option').addClass('disabled');
				this.$form.find('input').attr('disabled', true);
				
				this.$questionsList.eq(-1).find('.next').hide();
			}
		};
		
		//reload
		this.updateUI = function() {
			this.$numbers.find('.total').text(this.total);
			this.$progressBar.find('.tooltip .total').text(this.total);
			
			this.updateState();
		};
		
		this.updateState = function() {
			this.$numbers.find('.current').text(this.active);
			this.$progressBar.find('.tooltip .current').text(this.active);
			
			this.$questionsList.removeClass('active');
			this.$active.addClass('active').removeClass('previous')
			.prevAll().addClass('previous');
			this.$active.nextAll().removeClass('previous');
			
			var activeTop = app.utils.getOffset(this.$active).top;
			var formTop = app.utils.getOffset(this.$form).top;
			
			this.scrollY = Math.abs(app.utils.getOffset(this.$questions).top - activeTop);
			
			var transform = 'translate3d(0, -' + this.scrollY + 'px, 0)';
			
			this.$questions.css({
				transform: transform,
				'-webkit-transform': transform
			});
			
			this.$progressBar.css({
				width: (this.active / this.total * 100) + '%'
			});
			
			this.$progressBar[(this.active / this.total * window.innerHeight) > (window.innerHeight-50) ? 'addClass' : 'removeClass']('at-end');
			
			this.validateQuestion(this.$active);
			
			this.track('open', this.$active.attr('data-id'));
			ga('send', 'event', 'Questions', 'open', this.$active.find('h2').text());
			
			dataLayer.push({
				"event": "question" + this.active
			});
		};
		
		this.validateOption = function($optionCurrent) {
			$optionCurrent.parent().children().each(function() {
				var $option = $(this);
				
				var filled = $option.find('input:checked').length ? true : false;
			
				$option[filled ? 'addClass' : 'removeClass']('filled');
			});
			
			this.validateQuestion($optionCurrent.parents('.question'));
			
			this.track('answer', $optionCurrent.parents('.question').attr('data-id'), $optionCurrent);
			ga('send', 'event', 'Questions', 'answer', $optionCurrent.find('.name').text());
			
			dataLayer.push({
				"event": "ec.checkout",
				"ecommerce": {
					"checkout": {
						"actionField": {
							"step": this.active,
							"option": $optionCurrent.find('.name').text()
						},
						"products": [{
							"name": this.type.label
						}]
					}
				}
			});
		};
		
		this.validateInput = function($input) {
			var filled = $input.val().trim() ? true : false;
			
			if ($input.attr('data-filter') === 'email') {
				filled = $input.val().match(/^[\w-]+(\.[\w-]+)*@([a-z0-9-]+(\.[a-z0-9-]+)*?\.[a-z]{2,6}|(\d{1,3}\.){3}\d{1,3})(:\d{4})?$/);
			}
			
			$input[filled ? 'addClass' : 'removeClass']('filled');
			
			this.validateQuestion($input.parents('.question'));
		};
		
		this.validateQuestion = function($question) {
			var completed = $question.find('input:checked,input.filled').length ? true : false;
			var required = $question.hasClass('required');
			
			// $question[completed ? 'addClass' : 'removeClass']('filled');
			$question[$question.next().length ? (completed ? "addClass" : "removeClass") : "addClass"]("filled");
			$question[!required || completed ? 'addClass' : 'removeClass']('completed');
			
			if (!required) {
				// $question.find('.next a span').text(completed ? ($question.next().length ? 'Next question' : 'Submit') : 'Not required');
				
				$question.find(".next a span").text($question.next().length ? (completed ? "Next question" : "Not required") : "Submit");
			}
			
			this.$arrows.find('.prev')[this.active > 1 ? 'addClass' : 'removeClass']('active')
			.end().find('.next')[this.active < this.total && this.$active.hasClass('completed') ? 'addClass' : 'removeClass']('active');
		};
		
		this.updateTooltips = function() {
			this.$questionsList.find('.option .description').each(function() {
				$(this).css({
					left: $(this).parent().find('label span').width() + 60
				});
			});
		};
		
		this.setTrackingUrl = function(value) {
			this.trackingUrl = value;
		};
		
		this.track = function(type, questionId, $option) {
			if (!this.tracking || !questionId) {
				return;
			}
			
			var action = null;
			
			if ($option) {
				action = 'set';
				
				if ($option.find('input').attr('type') == 'checkbox') {
					action = $option.find('input').is(':checked') ? 'add' : 'remove';
				}
			}
			
			this.trackingQueue.push({
				type: type,
				question: questionId,
				option: $option ? $option.attr('data-id') : null,
				eaction: action
			});
			
			this.trackSend();
		};
		
		this.trackSend = function() {
			if (this._tracking || !this.trackingQueue.length) {
				return;
			}
			
			this._tracking = true;
			var self = this;
			
			var event = this.trackingQueue.shift();
			
			$.ajax({
				type: 'GET',
				url: this.trackingUrl,
				data: event
			}).done(function(payload) {
				self._tracking = false;
				self.trackSend();
			}).fail(function() {
				self._tracking = false;
				self.trackSend();
			});
		};
		
		this.getSection = function(id) {
			return this.sections.filter(function(row) {
				return row.id == id;
			})[0];
		};
		
		this.updatePrice = function() {
			var sections = [];
			var features = this.type.features.slice(0);
			var questions = [];
			var options = [];
			var i, j, k, section, question, option, item, feature, price, service;
			
			var items = [];
			var multiplier = {};
			var subtotal = {};
			
			var total = 0;
			
			this.$questionsList.filter('.filled.completed').each(function() {
				var $question = $(this);
				
				questions.push(parseInt($question.attr('data-id')));
				
				$question.find('.option.filled').each(function() {
					options.push(parseInt($(this).attr('data-id')));
				});
			});
			
			//get filled questions and load sections, multipliers
			for (i = 0; i < this.questions.length; i++) {
				question = this.questions[i];
				
				if (questions.indexOf(question.id) === -1) {
					continue;
				}
				
				item = {
					layer: question.layer,
					name: question.label,
					price: JSON.parse(JSON.stringify(subtotal)),
				};
				
				var optionsCount = 0;
				
				for (j = 0; j < question.options.length; j++) {
					option = question.options[j];
					
					if (options.indexOf(option.id) === -1) {
						continue;
					}
					
					optionsCount++;
					
					for (k = 0; k < option.sections.length; k++) {
						section = option.sections[k];
						
						if (question.type == 'section') {
							if (sections.indexOf(section.section_id) === -1) {
								sections.push(section.section_id);
							}
						} else {
							if (sections.indexOf(section.section_id) === -1) {
								continue;
							}
							
							item.price[section.section_id] += section.price;
							
							if (section.multiplier) {
								multiplier[section.section_id].push(section.multiplier);
							}
						}
					}
					
					for (k = 0; k < option.features.length; k++) {
						features.push(option.features[k]);
					}
				}
				
				for (j = 0; j < question.sections.length; j++) {
					section = question.sections[j];
					
					if (sections.indexOf(section.section_id) === -1) {
						continue;
					}
					
					item.price[section.section_id] += section.price;
					
					if (section.multiplier) {
						for (k = 0; k < optionsCount-1; k++) {
							multiplier[section.section_id].push(section.multiplier);
						}
					}
				}
				
				if (question.type == 'section') {
					for (j = 0; j < sections.length; j++) {
						multiplier[sections[j]] = [];
						subtotal[sections[j]] = 0;
					}
				} else {
					items.push(item);
				}
			}
			
			for (i = 0; i < this.features.length; i++) {
				feature = this.features[i];
				
				if (features.indexOf(feature.id) === -1 || !items.length) {
					continue;
				}
				
				item = {
					layer: feature.layer,
					name: feature.name,
					price: JSON.parse(JSON.stringify(subtotal))
				};
				
				for (j = 0; j < feature.sections.length; j++) {
					section = feature.sections[j];
					
					if (sections.indexOf(section.section_id) === -1) {
						continue;
					}
					
					item.price[section.section_id] += section.price;
					
					if (section.multiplier) {
						multiplier[section.section_id].push(section.multiplier);
					}
				}
				
				items.push(item);
			}
			
			console.log(' ');
			console.log("%cCALCULATION", 'font-weight: bold');
			
			for (i = 0; i < items.length; i++) {
				item = items[i];
				
				console.log("%c" + item.name, 'font-weight: bold');
				
				for (section in item.price) {
					price = item.price[section];
					
					if (item.layer != 'other') {
						for (j = 0; j < multiplier[section].length; j++) {
							price += (item.price[section] * multiplier[section][j]) - item.price[section];
						}
					}
					
					price = Math.ceil(price / 10) * 10;
					
					console.log(this.getSection(section).name, price);
					
					subtotal[section] += price;
				}
			}
			
			for (section in subtotal) {
				total += subtotal[section];
			}
			
			for (i = 0; i < this.services.length; i++) {
				service = this.services[i];
				
				if (!items.length) {
					continue;
				}
				
				console.log("%c" + service.name, 'font-weight: bold');
				
				for (j = 0; j < service.sections.length; j++) {
					price = 0;
					section = service.sections[j];
					
					if (sections.indexOf(section.section_id) === -1) {
						continue;
					}
					
					price += section.price;
					
					if (section.multiplier) {
						price += ((subtotal[section.section_id] * section.multiplier) - subtotal[section.section_id]);
					}
					
					price = Math.ceil(price / 10) * 10;
					
					console.log(this.getSection(section.section_id).name, price, section.multiplier);
				
					total += price;
				}
			}
			
			console.log(total);
			
			if (total != this.price) {
				if (this.priceAnimation) {
					this.priceAnimation.stop();
					this.priceAnimation = null;
				}
				
				this.price = total;
				var duration = Math.ceil(Math.abs(this.price - this.lastPrice) / 10);
				duration = duration < 200 ? 200 : duration;
				duration = duration > 700 ? 700 : duration;
				
				this.priceAnimation = $({
					price: this.lastPrice,
				}).animate({
					price: this.price
				}, {
					duration: duration,
					step: function(now) {
						self.lastPrice = Math.round(this.price);
						
						self.$price.text(self.lastPrice.toLocaleString());
					},
					complete: function() {
						self.lastPrice = self.price;
						self.$price.text(self.lastPrice.toLocaleString());
					}
				});
				
				this.$price.text(total.toLocaleString());
			}
		};
		
		this.handleKey = function(e, keyCode) {
			switch (keyCode) {
				case 13:
					e.preventDefault();
					this.go(1);
				break;
				
				case 38:
					e.preventDefault();
					this.go(-1);
				break;
				
				case 40:
					e.preventDefault();
					this.go(1, true);
				break;
				
				case 37:
				case 39:
					e.preventDefault();
				break;
			}
		};
		
		this._lastDelta = 0;
		this._canWheel = true;
		this.handleWheel = function(e) {
			var delta = e.type == "mousewheel" ? e.originalEvent.wheelDelta : 0;
			delta = e.type == "touchmove" ? (this.lastTouches.clientY - e.originalEvent.touches[0].clientY) * -1 : delta;
			
			var deltaMax = e.type == "touchmove" ? 25 : 50;
			
			if (!this._canWheel || (Math.abs(delta) > 1 && Math.abs(delta) < deltaMax)) {
				this._lastDelta = delta;
				
				this.lastTouches = e.type == "touchmove" ? e.originalEvent.touches[0] : [];
				
				return;
			}
			
			if (delta > 0 && delta > this._lastDelta) {
				this._canWheel = false;
				
				if (e.type == "mousewheel" || (e.type == "touchmove" && this.$active.scrollTop() <= 0)) {
					this.go(-1, true);
				}
			} else if (delta < 0 && delta < this._lastDelta) {
				this._canWheel = false;
				
				if (e.type == "mousewheel" || (e.type == "touchmove" && this.$active.scrollTop() + this.$active.innerHeight() >= this.$active[0].scrollHeight)) {
					this.go(1, true);
				}
			}
			
			if (!this._canWheel) {
				setTimeout(function() {
					this._canWheel = true;
				}.bind(this), e.type = "touchmove" ? 800 : 400);
			}
		};
		
		this.go = function(by, soft) {
			if (by > 0 && !this.$active.hasClass('completed')) {
				return;
			}
			
			var goTo = this.active + by;
			
			if (goTo < 1) {
				return;
			}
			
			if (goTo > this.total) {
				if (!soft && !this.preview) {
					ga('send', 'event', 'Calculation', 'submit', null, this.price);
					
					this.$form.addClass('sending').submit();
				}
				
				return;
			}
			
			this.active = goTo;
			this.updateState();
		};
		
		this.setup();
		this.updateUI();
	},
	estimate: function(id, uid, price, type) {
		var self = this;
		
		this.$elem = $('.estimate');
		this.$send = $('.estimate form');
		this.$modal = $(".estimate-modal");
		this.id = id;
		this.uid = uid;
		this.price = price;
		this.type = type;
		
		this._updatingName = false;
		this._updateNameAfter = false;
		
		this.setup = function() {
			this.$elem.find('textarea').each(function () {
				this.setAttribute('style', 'height:' + (this.scrollHeight) + 'px;overflow-y:hidden;');
			}).on('input', function () {
				this.style.height = 'auto';
				this.style.height = (this.scrollHeight) + 'px';
			});
			
			if (this.$elem.find('.project-name').val()) {
				this.$elem.find('.project-name').addClass('filled');
			}
			
			this.$elem.find('.project-name').on('input change', function() {
				if (self._updatingName) {
					self._updateNameAfter = true;
					return;
				}
				
				var val = $(this).val().trim();
				
				$(this)[val ? 'addClass' : 'removeClass']('filled');
				
				if (val === $(this).attr('data-last')) {
					return;
				}
				
				$(this).attr('data-last', val);
				
				self._updatingName = true;
				self._updateNameAfter = false;
				
				$.ajax({
					url: $(this).attr('data-action'),
					type: 'POST',
					data: {
						id: self.id,
						uid: self.uid,
						name: val
					},
					success: function(payload) {
						self._updatingName = false;
						
						if (self._updateNameAfter) {
							self.$elem.find('.project-name').change();
						}
						
						if (payload.status === 'success') {
							window.history.replaceState({}, document.title, payload.url);
						}
					}
				});
			});
			
			this.$send.on('submit', this.onSend.bind(this));
		};
		
		this.onSend = function() {
			if (this.$send.hasClass('sending')) {
				return;
			}
			
			this.$send.addClass('sending');
			this.$send.find('.error').text('');
			
			$.ajax({
				type: "POST",
				url: this.$send.attr('action'),
				data: new FormData(this.$send[0]),
				cache: false,
				contentType: false,
				processData: false,
			}).then(function(payload) {
				self.$send.removeClass('sending');
				
				if (payload.status === 'success') {
					self.$send.addClass('disabled')
					.find('button').text('Request sent');
					
					if (payload.redirect) {
						window.location.href = payload.redirect;
					}
				} else if (payload.status === 'error') {
					if (payload.message) {
						self.$send.find('.error').text(payload.message);
					}
					
					if (payload.errors) {
						for (var i in payload.errors) {
							self.$send.find(':input[name="' + i + '"]')
							.addClass('errorinput')
							.on('input.error change.error', function() {
								$(this).off('input.error change.error').removeClass('errorinput');
							});
						}
					}
				}
			});
			
			return false;
		};
		
		this.modal = function() {
			if (!this.$modal.length) {
				return;
			}
			
			setTimeout(function() {
				$(document.body).addClass("blur-estimate");
				
				self.$modal.addClass("show");
			}, 1000);
			
			this.$modal.on("click", ".mask", function() {
				$(this).parent().addClass("bounce").delay(100).queue(function() {
					$(this).dequeue().removeClass("bounce");
				});
			});
			
			this.$modal.on("submit", "form", function() {
				if (!self.modalValidate()) {
					return false;
				}
				
				ga('send', 'event', 'Estimate Modal', 'submit', null, this.price);
				
				dataLayer.push({
					"ecommerce": {
						"purchase": {
							"actionField": {
								"id": self.uid
							},
							"products": [{
								"name": self.type
							}]
						}
					}
				});
			});
		};
		
		this.modalValidate = function() {
			var hasError = false;
				
			this.$modal.find("form input").each(function() {
				var name = $(this).attr("name"),
					val = $(this).val(),
					error = false;
				
				if (name == "firstname" || name =="lastname") {
					error = val.length <= 2;
				} else if (name == "email") {
					error = !/^[\w-]+(\.[\w-]+)*@([a-z0-9-]+(\.[a-z0-9-]+)*?\.[a-z]{2,6}|(\d{1,3}\.){3}\d{1,3})(:\d{4})?$/.test(val);
				}
				
				$(this)[error ? "addClass" : "removeClass"]("error");
				
				if (error) {
					hasError = true;
				}
			});
			
			return !hasError;
		};
		
		this.setup();
		this.modal();
	}
};

$(function() {
	app.layout.init();
});