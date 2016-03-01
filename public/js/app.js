/* app.js */
(function($) {
	$('.resource-link').on('click', function(e) {
		e.preventDefault();
		var $target = $(e.target);
		var href = $target.attr('href');
		$(href).show().siblings().hide();
		$('#resources').show();
		$('#config').hide();
	});

	$('.page-header').on('click', function(e) {
		e.preventDefault();
		$('#config').show().siblings().hide();

	});
})(jQuery);