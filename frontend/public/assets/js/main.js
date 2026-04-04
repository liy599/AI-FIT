(function ($) {
    "use strict";

////////////////////////////////////////////////////////////////////////
// 01. Screen Width
var device_width = window.screen.width;

///////////////////////////////////////////////////////////////////////
// 02. Mobile menu 

$('.cl_menubar').on('click', function () {

	$('.zq_mobile_menu').addClass("open");

	$('.zq_mobile_menu').animate({ left: 0 });

});

$('.zq_mobile_menu .close-menu, .one-scroll .menu-navbar .main-menu > li').on('click', function () {

	$('.zq_mobile_menu').removeClass("open").delay(300).animate({ left: "-100%" });
	$('.zq_mobile_menu .menu-navbar .main-menu .dmenu').removeClass("dopen");
	$('.zq_mobile_menu .menu-navbar .main-menu .sub-menu').slideUp();

});

$('.zq_mobile_menu .menu-navbar .main-menu > li').on('mouseenter', function () {
	$(this).removeClass('hoverd').siblings().addClass('hoverd');
});

$('.zq_mobile_menu .menu-navbar .main-menu > li').on('mouseleave', function () {
	$(this).removeClass('hoverd').siblings().removeClass('hoverd');
});


$('.main-menu > li .dmenu').on('click', function () {
	$(this).parent().parent().find(".sub-menu").toggleClass("sub-open").slideToggle();
	$(this).toggleClass("dopen");
});

////////////////////////////////////////////////////////////////////////
// 03. Search Header
$('.cl_search_popup').on('click', function() {
	$('body').addClass('search-active');
})
$(".ba-search-popup .ba-color-layer").on("click", function () {
	$("body").removeClass("search-active");
});


// 04. nice select
$('.has-nice-select ,.has-nice-select-2, .has-nice-select_common').niceSelect();

////////////////////////////////////////////////////////////////////////
// 05. data background
$("[data-background]").each(function(){
	$(this).css("background-image","url("+$(this).attr("data-background") + ") ")
});


////////////////////////////////////////////////////////////////////////
// 06. service active 

const navLinks = document.querySelectorAll('.cl_service-item');

navLinks.forEach(navLink => {
	navLink.addEventListener('click', () => {
		document.querySelector('.active')?.classList.remove('active');
		navLink.classList.add('active');
	})
})

/////////////////////////////////////////////////////
// 07. Cursor Animations
var client_cursor = document.getElementById("client_cursor");
function mousemoveHandler(e) {
    try {
      const target = e.target;

      let tl = gsap.timeline({
        defaults: {
          x: e.clientX,
          y: e.clientY,
        }
      })
      let t2 = gsap.timeline({
        defaults: {
          x: e.clientX,
          y: e.clientY,
        }
      })

      // Main Cursor Moving 
      tl.to(".cursor1", {
        ease: "power2.out"
      })
        .to(".cursor2", {
          ease: "power2.out"
        }, "-=0.4")

    } catch (error) {
      console.log(error)
    }

}
document.addEventListener("mousemove", mousemoveHandler);

//////////////////////////////////////////////////////////////////////////////////
// 08. Active GSAP
if (document.querySelector("#has_smooth").classList.contains("has-smooth")) {
    const smoother = ScrollSmoother.create({
      smooth: 1.35,
      effects: device_width < 1025 ? false : true,
      smoothTouch: 0.1,
      normalizeScroll: false,
      ignoreMobileResize: true,
    });
}

///////////////////////////////////////////////////////////////////////
// 09. blog active
// blog 2 
const blogActive = new Swiper(".h2_blog-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	breakpoints: {
		0: {
			slidesPerView: 1,
			},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 2,
		},
		992: {
			slidesPerView: 2,
		},
		1200: {
			slidesPerView: 3
		},
		1400: {
			slidesPerView: 3
		}
	}
});

// blog 3
const blogActiveThree = new Swiper(".h3_blog-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	pagination: {
		el: ".cl_pagination_blog_3",
		clickable: true,
	},
	navigation: {
		nextEl: ".h3_blog-prev",
		prevEl: ".h3_blog-next",
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
			},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 1,
		},
		992: {
			slidesPerView: 1,
		},
		1200: {
			slidesPerView: 1,
		},
		1400: {
			slidesPerView: 2
		}
	}
});

///////////////////////////////////////////////////////////////////////
// 10. team active
// team one
const teamActive = new Swiper(".team-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	pagination: {
		el: ".cl_pagination_team",
		clickable: true,
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
			},
		576: {
			slidesPerView: 2,
		},
		768: {
			slidesPerView: 2,
		},
		992: {
			slidesPerView: 3,
		},
		1200: {
			slidesPerView: 4
		},
		1400: {
			slidesPerView: 4
		}
	}
});

// team 2
const teamActiveTwo = new Swiper(".h2_team-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	navigation: {
		nextEl: ".h2_team-prev",
		prevEl: ".h2_team-next",
	},
	pagination: {
		el: ".cl_pagination_team_2",
		clickable: true,
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
			},
		576: {
			slidesPerView: 2,
		},
		768: {
			slidesPerView: 2,
		},
		992: {
			slidesPerView: 3,
		},
		1200: {
			slidesPerView: 4
		},
		1400: {
			slidesPerView: 4
		}
	}
});

///////////////////////////////////////////////////////////////////////
// 11. brand active
const brandActiveOne = new Swiper(".cl_brand-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	autoplay: {
		delay: 800,
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
			},
		481: {
			slidesPerView: 2,
		},
		576: {
			slidesPerView: 2,
		},
		768: {
			slidesPerView: 3,
		},
		992: {
			slidesPerView: 4,
		},
		1200: {
			slidesPerView: 5
		},
		1400: {
			slidesPerView: 5
		}
	}
});

///////////////////////////////////////////////////////////////////////
// 02.testimonial active
// testimonial 1
const testimonialActive = new Swiper(".testimonial-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	autoplay: {
		delay: 800,
	},
	pagination: {
		el: ".cl_pagination_testimonial",
		clickable: true,
	},
	navigation: {
		nextEl: ".testimonial-prev",
		prevEl: ".testimonial-next",
		},
		breakpoints: {
		0: {
			slidesPerView: 1,
		},
		481: {
			slidesPerView: 1,
		},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 1,
		},
		992: {
			slidesPerView: 2,
		},
		1200: {
			slidesPerView: 2
		},
		1400: {
			slidesPerView: 2
		}
	}
});

// testimonial 3
const testimonialActiveThree = new Swiper(".h3_testimonial-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	autoplay: {
		delay: 800,
	},
	pagination: {
		el: ".cl_pagination_testimonial_3",
		clickable: true,
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
		},
		481: {
			slidesPerView: 1,
		},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 1,
		},
		992: {
			slidesPerView: 1,
		},
		1200: {
			slidesPerView: 1
		},
		1400: {
			slidesPerView: 1
		},
		1600: {
			slidesPerView: 1
		}
	}
});

// testimonial 4
const testimonialActiveFour = new Swiper(".h4_testimonial-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	autoplay: {
		delay: 800,
	},
	pagination: {
		el: ".cl_pagination_testimonial_4",
		clickable: true,
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
		},
		481: {
			slidesPerView: 1,
		},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 1,
		},
		992: {
			slidesPerView: 1,
		},
		1200: {
			slidesPerView: 1
		},
		1400: {
			slidesPerView: 1
		},
		1600: {
			slidesPerView: 1
		}
	}
});

///////////////////////////////////////////////////////////////////////
// 12. service active
// service 2
const serviceActiveOne = new Swiper(".h2_service-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	autoplay: {
		delay: 1000,
	},
	navigation: {
		nextEl: ".h2_service-prev",
		prevEl: ".h2_service-next",
	},
	pagination: {
		el: ".cl_pagination_service",
		clickable: true,
	},
	breakpoints: {
		0: {
			slidesPerView: 1,
		},
		481: {
			slidesPerView: 1,
		},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 2,
		},
		992: {
			slidesPerView: 2,
		},
		1200: {
			slidesPerView: 3
		},
		1400: {
			slidesPerView: 3
		}
	}
});

// service 4
const serviceActiveFour = new Swiper(".h4_service-active", {
	slidesPerView: 1,
	spaceBetween: 30,
	loop: true,
	speed: 2000,
	navigation: {
		nextEl: ".h4_service-prev",
		prevEl: ".h4_service-next",
		},
		breakpoints: {
		0: {
			slidesPerView: 1,
		},
		481: {
			slidesPerView: 1,
		},
		576: {
			slidesPerView: 1,
		},
		768: {
			slidesPerView: 2,
		},
		992: {
			slidesPerView: 3,
		},
		1200: {
			slidesPerView: 3
		},
		1400: {
			slidesPerView: 3
		}
	}
});

///////////////////////////////////////////////////////////////////////
// 13. ticker slider for heading
$("#cl_highlight-ticker").bxSlider({
	minSlides: 1,
	maxSlides: 1,
	slideMargin: 0,
	ticker: true,
	speed: 25000,
});


///////////////////////////////////////////////////////////////////////
// 14. odometer js 
$('.count_one').appear(function (e) {
	var odo = $(".count_one");
	odo.each(function () {
		var countNumber = $(this).attr("data-count");
		$(this).html(countNumber);
	});
});

///////////////////////////////////////////////////////////////////////
// 15. magnificPopup video view
$('.popup-video').magnificPopup({
	type: 'iframe'
});



})(jQuery);