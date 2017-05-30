# gmail_filter

This script is a google drive apps script, using the GmailApp (https://developers.google.com/apps-script/reference/gmail/gmail-app)
to filter email.  

The way I do this is I have a simple set of filters on gmail, most of which end up with the label "unprocessed".  Then I apply my own filters using this script.

To use this, take apply_label.gs and set it up in scripts.google.com.  Add another script and create a funciton like:

```javascript
var BATCH_SIZE=1;
var DEBUG = true;
var DEBUG_FILTER=null;
//var DEBUG_FILTER="name";

function process_unprocessed()
{
  var filters = [...];

  var post_process = {
    archive: {archive: true, removeLabel: "unprocessed"},
    not_archive: {inbox: true, removeLabel: "unprocessed"},
  }
  var selection = '-in:inbox label:unprocessed';
  labeler(filters, post_process, selection);
}
```

each element of 'filters' is a hash containing:
id: string.  Used for debugging a filter and logging
name: string.  The label the filter will get.  If it does not exist, it will be auto created.  sub-labels path seperated.  Ex: "foo/bar"
prefix_name: string.  Instead of applying a filter "name" use this and add the first group match of a regex filter
archive: bool.  Move to archive
markRead: bool.  Mark as read
star: bool Star email.
to, from, cc, body, subject:  regex.  Filter on this.  If using more than one, and the operations together.  If you need more advanced filtering, use 'filters'
filters: array.  each element of the array is an array of 2 elements.  first element is to/from/cc/body/subject.  Second element is a regex.  Conditions are applied in-order.  If the first letter of name is a !, it will negate the result.

post_process has 'archive' and 'not_archive' which is a set done after all the messages in a thread have been processed.  Here you can:
addLabel: string label, array of labels, or function returning array of labels
removeLabel: same as add
archive: bool: move to archive
inbox: bool, move to inbox

DEBUG enables logging
DEBUG_FILTER, only process one filter with this id

BATCH_SIZE: amount of emails in every search to apply.  I stick with 200.

Once this is setup you will want to goto edit/current projects triggers
Add a new trigger for your function, time based, minutes counter, every minute

NOTE: with a batch of 200 and processing every minute, i find gmail will let me process less than 10k a day before I hit the limit.  Any heavy-hitter filters should be done with gmail filtering.  
