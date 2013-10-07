/*
 * Animation handlers for slides, these handle interpolation/tweening/video control etc.
 * @author: Isaac Dawson https://github.com/wirepair/
 *
 * Ripped out Sim.Animation from the Sim.js to create the basis of supporting
 * multiple animation types.
 */

ThreePrez = {};

ThreePrez.AnimationGroup = function()
{
	Sim.Object.call();
	this.running = false;
	this.animations = new Queue();
	// Do we run one animation after another? Or all at same time.
	this.isChain = false; // default: run all at same time.
}

ThreePrez.AnimationGroup.prototype = new Sim.Object();

/*
 * init() - MUST be called after all animations are added.
 *
 */
ThreePrez.AnimationGroup.prototype.init = function(param)
{
	param = param || {};
	if (this.animations.empty())
	{
		throw "Animations not set for AnimationGroup, must add before calling init()";
	}
	//this.duration = param.duration ? param.duration : ThreePrez.Animator.default_duration;
	this.isChain = param.isChain || false;
	this.setOnGroupComplete();
}
/*
 * setOnGroupComplete - If the animation group is chained we iterate over
 * all animations and set a on complete callback to the group's onComplete. The
 * final animation has an onGroupComplete callback set so we can signify when all 
 * are completed.
 *
 * For concurrent animations, we get the largest duration animation and
 * set that animations on_group_complete_callback to the onGroupComplete.
 *
 */
ThreePrez.AnimationGroup.prototype.setOnGroupComplete = function()
{
	var final_animation = this.animations.peek(); // set it to the first.
	do 
	{
		var animation = this.animations.next();
		// also we only set the onGroupComplete of the longest running so
		// we will know when all animations are done.
		//if (this.isChain)
		//{
			animation.on_complete_callback = this.onComplete;
		//}
		if (animation.duration >= final_animation.duration)
		{
			final_animation = animation;
			console.log("final_animation now set to: " + animation.name);
		}
		animation.parent = this; // safe a reference to the parent so we can call()
	} while( this.animations.peek() != null );
	console.log("AnimationGroup has " + this.animations.length() + " animations.");
	
	if (this.isChain)
	{
		final_animation = this.animations.last();
	}
	final_animation.on_group_complete_callback = this.onGroupComplete;	// set our group complete callback.
	final_animation.on_complete_callback = null; // unset the on complete since the group complete will take over.
	this.animations.reset();

}
ThreePrez.AnimationGroup.prototype.set = function(animations)
{
	this.animations.setList(animations);
}

ThreePrez.AnimationGroup.prototype.add = function(animation)
{
	this.animations.push(animation);
}

ThreePrez.AnimationGroup.prototype.start = function()
{
	if (this.running)
		return;
	// if we are chained, we run one animation at a time.
	if (this.isChain)
	{
		console.log("isChain is true. running next animation.");
		var animation = this.animations.next();
		if (animation == null)
		{
			this.running = false;
			this.onComplete();
			return;
		}
		animation.start();
		this.running = true;	
	}
	else
	{
		do {
			var animation = this.animations.next();
			animation.start();
		} while( this.animations.peek() != null );
		this.animations.reset();
		this.running = true;				
	}
}

ThreePrez.AnimationGroup.prototype.stop = function()
{
	this.running = false;
	this.animations.reset(); // make sure we are at the beginning.
	do {
		var animation = this.animations.next();
		animation.stop();
	} while( this.animations.peek() != null );
	this.animations.reset();
	console.log("AnimationGroup.stop");
	this.onComplete();
}

ThreePrez.AnimationGroup.prototype.update = function()
{
	if (!this.running)
		return;

	if (this.isChain)
	{
		var animation = this.animations.current();
		animation.update();
		return;
	}

	do {
		var animation = this.animations.next();
		animation.update();
	} while( this.animations.peek() != null );
	this.animations.reset(); // reset back to beginning for next update call.
}

/* onComplete - Note if a chain we move to the next animation by calling
 * start(), we also set running to false so start() will actually start.
 *
 */
ThreePrez.AnimationGroup.prototype.onComplete = function()
{
	console.log("AnimationGroup.onComplete called.");
	if (this.isChain && this.running == true)
	{
		this.running = false;
		// starts the next animation in our chain.
		this.start();
		return;
	}

}

ThreePrez.AnimationGroup.prototype.onGroupComplete = function()
{
	console.log("AnimationGroup ONGROUPCOMPLETE complete.");
	this.running = false;
	this.animations.reset(); // reset so if we are recalled we are at beginning.
	g_publisher.publish("complete");
}

/*
 * Base Animator Object for wrapping any animation type 
 *  ThreePrez.KeyFrameAnimator and TweenjsAnimator inhert this.
 */
ThreePrez.Animator = function()
{
	Sim.Object.call();
	this.running = false;
	this.parent = null; // reference to the group animation if it exists.
	this.on_group_complete_callback = null;
}

ThreePrez.Animator.prototype = new Sim.Object();

ThreePrez.Animator.prototype.init = function(param)
{

}

ThreePrez.Animator.prototype.start = function()
{
	if (this.running)
		return;
	
	this.startTime = Date.now();
	this.running = true;
}

ThreePrez.Animator.prototype.stop = function()
{
	this.running = false;
	console.log("Animator.stop");
	this.onComplete();
}

// Update - drive key frame evaluation
ThreePrez.Animator.prototype.update = function()
{
	if (!this.running)
		return;
}
/*
 * onComplete - sends out a message saying we are
 * complete. NOTE: if part of an animation group this
 * method will call the animation goup's onComplete instead.
 */
ThreePrez.Animator.prototype.onComplete = function()
{
	console.log("ThreePrez.Animator.onComplete called for " + this.name);
	this.running = false;
	if ( this.on_complete_callback != null)
	{
		this.on_complete_callback.call(this.parent);
		return;
	}
	// must call animation groups ongroupcomplete if last animation in group.
	if ( this.on_group_complete_callback == null )
	{
		console.log("ThreePrez.Animator.onComplete on_group_complete_callback is null for " + this.name);
		g_publisher.publish("complete");
	}
	else
	{
		console.log("==================This is the final animation, signaling group complete.");
		this.on_group_complete_callback.call(this.parent);
	}
}

// Statics
ThreePrez.Animator.default_duration = 1000;


ThreePrez.VideoAnimator = function()
{
	ThreePrez.Animator.call();
}

ThreePrez.VideoAnimator.prototype = new ThreePrez.Animator;

ThreePrez.VideoAnimator.prototype.init = function(param)
{
	param = param || {};
	this.complete_on_stop = param.complete_on_stop || false;
	this.video = param.video;
	this.video.addEventListener('ended',this.onComplete.bind(this));
	this.video_texture = param.video_texture;
	this.image_context = param.image_context;
}

ThreePrez.VideoAnimator.prototype.start = function()
{
	if (this.running)
		return;

	console.log("calling start in VideoAnimator");
	this.video.play();
	this.running = true;
}

ThreePrez.VideoAnimator.prototype.stop = function()
{
	this.running = false;
	console.log("VideoAnimator.stop");
	this.video.stop();
	this.onComplete();
}

ThreePrez.VideoAnimator.prototype.update = function()
{
	if (!this.running)
		return;

	if ( this.video.readyState === this.video.HAVE_ENOUGH_DATA ) 
    {

        this.image_context.drawImage( this.video, 0, 0 );

        if ( this.video_texture ) 
        {
            this.video_texture.needsUpdate = true;
        }
    }
}

/* SINGLE ANIMATION TweenJS style*/
ThreePrez.TweenjsAnimator = function()
{
	ThreePrez.Animator.call();
}
ThreePrez.TweenjsAnimator.prototype = new ThreePrez.Animator;

ThreePrez.TweenjsAnimator.prototype.init = function(param)
{
	param = param || {};
	this.tweens =  param.tweens || [];
	this.duration = param.duration || 2000;
	// for signaling completion. Add a completion tween to the end.
	var complete = new TWEEN.Tween( this ).to({}, param.duration);
	complete.name = "complete";
	complete.onComplete( this.onComplete );
	this.tweens.push(complete);

}

ThreePrez.TweenjsAnimator.prototype.start = function()
{
	if (this.running)
		return;

	console.log("calling start in TweenjsAnimator # of tweens: " + this.tweens.length);
	for (var i = 0; i < this.tweens.length; i++)
	{
		this.tweens[i].start();
	}
	this.running = true;
}	

ThreePrez.TweenjsAnimator.prototype.stop = function()
{
	this.running = false;
	console.log("TweenjsAnimator.stop");
	this.onComplete();
}

ThreePrez.TweenjsAnimator.prototype.update = function()
{
	if (!this.running)
		return;
	
	TWEEN.update();
}

ThreePrez.TweenjsAnimator.prototype.onComplete = function()
{
	console.log("TweenjsAnimator onComplete called.");
	this.running = false;

	// must call animation groups oncomplete if part of a group.
	if ( this.on_complete_callback != null)
	{
		this.on_complete_callback.call(this.parent);
	}
	// must call animation groups ongroupcomplete if last animation in group.
	if ( this.on_group_complete_callback == null )
	{
		console.log("This tweenjs animation is complete and no on_group_complete_callback set: " + this.name);
		g_publisher.publish("complete");
	}
	else
	{
		console.log("Tweenjs is final animation, signaling group complete.");
		this.on_group_complete_callback.call(this.parent);
	}
	
}

// KeyFrameAnimator class
// Construction/initialization
ThreePrez.KeyFrameAnimator = function() 
{
    ThreePrez.Animator.call();
	
	this.interps = [];
	this.running = false;
}

ThreePrez.KeyFrameAnimator.prototype = new ThreePrez.Animator; //new Sim.Object;
	
ThreePrez.KeyFrameAnimator.prototype.init = function(param)
{
	param = param || {};
	
	if (param.interps)
	{
		this.createInterpolators(param.interps);
	}	    		

	this.duration = param.duration ? param.duration : ThreePrez.KeyFrameAnimator.default_duration;
	this.loop = param.loop ? param.loop : false;
}

ThreePrez.KeyFrameAnimator.prototype.createInterpolators = function(interps)
{
	var i, len = interps.length;
	for (i = 0; i < len; i++)
	{
		var param = interps[i];
		var interp = new ThreePrez.Interpolator();
		interp.init({ keys: param.keys, values: param.values, target: param.target });
		this.interps.push(interp);
	}
}

// Start/stop
ThreePrez.KeyFrameAnimator.prototype.start = function()
{
	if (this.running)
		return;
	console.log("calling start in KeyFrameAnimator: " + this.name);
	this.startTime = Date.now();
	this.running = true;
}

ThreePrez.KeyFrameAnimator.prototype.stop = function()
{
	this.running = false;
	console.log("KeyFrameAnimator.stop");
	this.onComplete();
}

// Update - drive key frame evaluation
ThreePrez.KeyFrameAnimator.prototype.update = function()
{
	if (!this.running)
		return;
	
	var now = Date.now();
	var deltat = (now - this.startTime) % this.duration;
	var nCycles = Math.floor((now - this.startTime) / this.duration);
	var fract = deltat / this.duration;

	if (nCycles >= 1 && !this.loop)
	{
		this.running = false;
		console.log("KeyFrameAnimator.update complete.");
		
		this.onComplete();
		var i, len = this.interps.length;
		for (i = 0; i < len; i++)
		{
			this.interps[i].interp(1);
		}
		return;
	}
	else
	{
		var i, len = this.interps.length;
		for (i = 0; i < len; i++)
		{
			this.interps[i].interp(fract);
		}
	}
}
// Statics
ThreePrez.KeyFrameAnimator.default_duration = 1000;

//Interpolator class
//Construction/initialization
ThreePrez.Interpolator = function() 
{
 Sim.Object.call();
	    		
	this.keys = [];
	this.values = [];
	this.target = null;
	this.running = false;
}

ThreePrez.Interpolator.prototype = new Sim.Object;
	
ThreePrez.Interpolator.prototype.init = function(param)
{
	param = param || {};
	
	if (param.keys && param.values)
	{
		this.setValue(param.keys, param.values);
	}	    		

	this.target = param.target ? param.target : null;
}

ThreePrez.Interpolator.prototype.setValue = function(keys, values)
{
	this.keys = [];
	this.values = [];
	if (keys && keys.length && values && values.length)
	{
		this.copyKeys(keys, this.keys);
		this.copyValues(values, this.values);
	}
}

//Copying helper functions
ThreePrez.Interpolator.prototype.copyKeys = function(from, to)
{
	var i = 0, len = from.length;
	for (i = 0; i < len; i++)
	{
		to[i] = from[i];
	}
}

ThreePrez.Interpolator.prototype.copyValues = function(from, to)
{
	var i = 0, len = from.length;
	for (i = 0; i < len; i++)
	{
		var val = {};
		this.copyValue(from[i], val);
		to[i] = val;
	}
}

ThreePrez.Interpolator.prototype.copyValue = function(from, to)
{
	for ( var property in from ) {
		
		if ( from[ property ] === null ) {		
		continue;		
		}

		to[ property ] = from[ property ];
	}
}

//Interpolation and tweening methods
ThreePrez.Interpolator.prototype.interp = function(fract)
{
	var value;
	var i, len = this.keys.length;
	if (fract == this.keys[0])
	{
		value = this.values[0];
	}
	else if (fract >= this.keys[len - 1])
	{
		value = this.values[len - 1];
	}

	for (i = 0; i < len - 1; i++)
	{
		var key1 = this.keys[i];
		var key2 = this.keys[i + 1];

		if (fract >= key1 && fract <= key2)
		{
			var val1 = this.values[i];
			var val2 = this.values[i + 1];
			value = this.tween(val1, val2, (fract - key1) / (key2 - key1));
		}
	}
	
	if (this.target)
	{
		if (this.target instanceof Array)
		{
			for (var i = 0; i < this.target.length; i++)
			{
				this.copyValue(value, this.target[i]);	
			}
		}
		else
		{
			this.copyValue(value, this.target);
		}
	}
}

ThreePrez.Interpolator.prototype.tween = function(from, to, fract)
{
	var value = {};
	for ( var property in from ) {
		
		if ( from[ property ] === null ) {		
		continue;		
		}

		var range = to[property] - from[property];
		var delta = range * fract;
		value[ property ] = from[ property ] + delta;
	}
	
	return value;
}