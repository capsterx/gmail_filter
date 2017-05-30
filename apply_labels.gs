var Log = function(out) {
  if (DEBUG)
  {
    Logger.log(out);
  }
};
  
var Labeler = function() {
  this.labelCache = {};
}

Labeler.prototype = {
 test: function() {
   return this.labelCache;
 },
 
 findOrCreateLabel: function(name) {
   if (this.labelCache[name] === undefined) {
     var labelObject = GmailApp.getUserLabelByName(name);
     if( labelObject ){
       this.labelCache[name] = labelObject;
      } else {
        this.labelCache[name] = GmailApp.createLabel(name);
        Log("Created new label: [" + name + "]");
      }
    }
    return this.labelCache[name];
  },

  getLabel: function(name) {
  // create nested labels by parsing "/"
    var label;
    var labelName = "";
    var self = this;
 
    name.split('/').forEach(function(labelPart, i) {
      labelName = labelName + (i===0 ? "" : "/") + labelPart.trim();
      label = self.findOrCreateLabel(labelName);
    });
    return label;
  },

  applyLabel: function(name, thread){
    var label = this.getLabel(name);
    thread.addLabel(label);
  },
  
  removeLabel: function(name, thread) {
    var label = this.getLabel(name);
    thread.removeLabel(label);
  },
};


var LabelMessage = function(message, filter) {
  this.message = message;
  this.filter = filter;
};

var getFilters = function() {
  return {
    to: function(filter, message) {
      var str = message.getTo();
      var match = filter.exec(str);
      Log("Match to attempt=" + (match != null ? 'true' : 'false') + " " + str);
      return match;
    },
    
    from: function(filter, message) {
      var str = message.getFrom()
      var match = filter.exec(str);
      Log("Match from attempt=" + (match != null ? 'true' : 'false') + " " + str);
      return match;
    },
    
    subject: function(filter, message)
    {
      var str = message.getSubject()
      var match = filter.exec(str);
      Log("Match subject attempt=" + (match != null ? 'true' : 'false') + " " + str);
      return match;
    },
    
    body: function(filter, message) {
      var str = message.getPlainBody()
      var match = filter.exec(str);
      Log("Match body attempt=" + (match != null ? 'true' : 'false') + " " + message.getSubject());      
      return match;
    },
    
    cc: function(filter, message) {
      var str = message.getCc()
      var match = filter.exec(str);
      Log("Match body attempt=" + (match != null ? 'true' : 'false') + " " + message.getCc());      
      return match;
    }
  }
}

LabelMessage.prototype = {  
  doesMatch: function() {
    var message=this.message;
    var filter=this.filter;
    
    var filterer = getFilters(message);
    var filters = filter.filters;
    
    if (!filters)
    {
      filters = []
      for (key in filterer)
      {
        if (filter.hasOwnProperty(key))
        {
          filters.push([key, filter[key]]);
        }
      }
    }
    
    var matches = undefined;

    matches = undefined;
    Log("Current filter: (" + filter.id + ") " + message.getSubject());
    
    for (v in filters) {
      v = filters[v];
      
      if (DEBUG_FILTER && DEBUG_FILTER != filter.id)
      {
        Log("Skipping filter " + filter.id + " looking for " + DEBUG_FILTER);
        continue;
      }
      var filter_name = v[0];
      var filter_match = v[1];

      Log("filter=" + filter_name)
      var negate_result = false;

      if (filter_name[0] == "!")
      {
        negate_result = true;
        filter_name = filter_name.substr(1);
      }
      Log("filter loop=" + filter_name + " matches=" + matches);
      if (!filterer.hasOwnProperty(filter_name))
      {
        throw "Unknwon filter type " + filter_name;
      }
      var current_match = filterer[filter_name](filter_match, message);
      
      if (negate_result)
      {
        if (current_match == null)
        {
          matches = ["negate"];
        }
        else
        {
          matches = null;
        }
      }
      else
      {
        matches = current_match;
      }
      Log("negate=" + (negate_result ? 'true' : 'false') + ' result=' + (matches !== null ? 'true' : 'false'))
      if (matches === null)
      {
        break;
      }
    }
    return matches;
  },
  
  getLabelsAndMark: function(matches, archive) {
    var message=this.message;
    var filter=this.filter;
    Log("matches=" + matches)
    
    if (matches !== undefined && matches !== null) {
      var label;
      if (filter.name)
      {
        label = filter.name;
      }
      else if (matches[1])
      {
        label = matches[1];
        if (filter.prefix_name)
          label = filter.prefix_name + label;
      }
      
      // toggle flags
      if (filter.star) 
        message.star();
      if (filter.markRead) 
        message.markRead();
      
      // prevent archive if filter explicitly sets "archive" to false (if "archive" is not defined, continue)
      if (filter.archive !== undefined && !filter.archive) 
        archive = false;
      if (filter.archive == true && archive == undefined)
        archive = true;
      return [label, archive];
    }
    else
    {
      Log("Filter not matched: " + message.getFrom());
      return false;
    }
  },
}

var LabelThread = function(thread, filters, post, label) {
  this.thread = thread;
  this.filters = filters;
  this.post = post;
  this.label = label;
}

LabelThread.prototype = { 
  applyLabels: function() {
    var messages = this.thread.getMessages();
    if (messages == null) 
      return; // nothing to do
    
    var labels = {}
    var archive;
    for (var message in messages) {
      message = messages[message];
      for (var filter in this.filters)
      {
        filter = this.filters[filter];
        
        var applyLabel = function(filter) {
          var labeler = new LabelMessage(message, filter);
          var match = labeler.doesMatch();
          if (match)
          {
            var label = labeler.getLabelsAndMark(match, archive);
            if (label)
            {
              labels[label[0]] = true;
              archive = label[1];
            }
          }
          return match;
        }
        
        if (Array.isArray(filter))
        {
          for (var f in filter)
          {
            f = filter[f];
            if (applyLabel(f))
            {
              break;
            }
          }
        }
        else
        {
          applyLabel(filter);
        }
      }
    }
    
    Log("Apply labels")
    Log(labels)
    labels = Object.keys(labels);
    for (var label in labels) {
      label = labels[label];
      this.label.applyLabel(label, this.thread);
    };
    
    
    if (archive) {
      this.post_process(this.post.archive);
    }
    else {
      this.post_process(this.post.not_archive);
    }
  },
  
  post_process: function(post) {
    if (post.archive) {
      this.thread.moveToArchive();
    }
    var process = function(labeler, funcname, thread, value)
    {
      if (value instanceof Function) {
        value = value(thread);
      }
      if (!Array.isArray(value))
      {
        value = [value]
      }
      
      for (var label in value) {
        label = value[label];
        labeler[funcname](label, thread);
      }
    }
    
    if (post.removeLabel) {
      process(this.label, "removeLabel", this.thread, post.removeLabel);
    }
    if (post.addLabel) {
      process(this.label, "applyLabel", this.thread, post.addLabel);
    }
    if (post.inbox) {
      this.thread.moveToInbox();
    }
  }
}

var labeler = function(filters, post_process, selection) {
  var threads = GmailApp.search(selection, 0, BATCH_SIZE);
  var labeler = new Labeler();

  if (filters) {
    GmailApp.getMessagesForThreads(threads);
  }
  Log("Starting up");
  
  for (var thread in threads)
  {
    thread = threads[thread];
    var thread_labeler = new LabelThread(thread, filters, post_process, labeler);

    if (filters) {
      thread_labeler.applyLabels();
    }
    else {
      //TODO: maybe we can do in bulk?
      thread_labeler.post_process(post_process.not_archive);
    }
  }
}
