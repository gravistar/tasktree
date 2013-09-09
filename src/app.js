/**
 * Summary:
 *      The main app of List Tree!
 */

var DROPBOX_APP_KEY = 'nvhuh359xzvfexc';

var client = new Dropbox.Client({key: DROPBOX_APP_KEY});

$(function (){
    var taskTable, taskTableId = "tasks", $main = $("#main");

    $('#loginButton').click(function(e){
        e.preventDefault();
        client.authenticate();
    });

    // tries auth with cached credentials
    client.authenticate({interactive:false}, function(error){
        if (error){
            alert("Authentication error: " + error);
        }
    });

    if (client.isAuthenticated()) {
        $("#loginButton").hide();
        $main.show();

        client.getDatastoreManager().openDefaultDatastore(function (error, datastore){

            if (error) {
                alert("Error opening default datastore: " + error);
            }

            taskTable = datastore.getTable(taskTableId);

            // add global listeners
            addGlobalElements();

            // render existing tasks
            _.each(TreeUtil.allRootRecords(taskTable), taskChangedCb);

            // add records changed listeners
            addRecordsChangedListeners(datastore);
        })
    }

    // UI Listener setup
    /**
     * Sets up the button and form which allows adding a global task
     */
    function addGlobalElements(){
        var $globalCreateTask = $("#globalCreateTask");
        $globalCreateTask.append(ich.taskForm());
        $globalCreateTask.find(".taskForm").hide();

        // button toggles the form
        $globalCreateTask.find("button").click(function (e){
            e.preventDefault();
            $globalCreateTask.find(".taskForm").toggle();
        });

        // have the add button use the global create
        $globalCreateTask.find(".taskAdd").click(globalTaskAddCb);
    }

    // UI Listener callbacks
    /**
     * Invoked when task form for adding a global task is submitted.
     * @param e
     */
    function globalTaskAddCb(e){
        e.preventDefault();
        var $parent = $(this).closest(".taskForm");
        console.log("break 1");
        createTaskFromForm($parent, TreeUtil.NO_PARENT);
    }

    /**
     * Invoked when task form for adding a subtask of task is submitted.
     * @param e
     */
    function taskAddCb(e){
        e.preventDefault();
        var $this = $(this),
            $parentTask = $this.closest(".task"),
            $parent = $this.parent();
        createTaskFromForm($parent, $parentTask.attr("id"));
    }

    /**
     * Puts a new task in the table. Still need to figure out weighting that
     * feels natural.
     * @param $parent {Zepto element}. Zepto selector on parent div.
     * @param parentId {String}. Id of parent task.
     */
    function createTaskFromForm($parent, parentId){
        var desc = $parent.find("input[name='desc']").val();
        taskTable.insert(TaskTree.buildTask(parentId, desc, 0.0, false, false));
    }

    /**
     * Adds all the UI listeners
     * @param $root
     */
    function addButtonListeners($root) {
        var $taskForm = $root.children(".taskForm");

        var id = $root.attr("id");
        var task = taskTable.get(id);

        // delete callback (records changed listener)
        $root.find("button.taskDel").click(function(e){
            e.preventDefault();
            task.deleteRecord();
        });

        // toggle task form
        $root.find("button.showTaskForm").click(function(e){
            e.preventDefault();
            $taskForm.toggle();
        });

        // checkbox (records changed listener)
        $root.find("input[name='targetCompleted']").click(function(e){
            e.preventDefault();
            var checked = $(this).is(":checked");
            var completeTime = null;
            if (checked) {
                completeTime = new Date();
            }
            task.set("completeTime", completeTime);
        })

        // task add
        $taskForm.find("button.taskAdd").click(taskAddCb);

        // toggle completion
        $root.find("button.showCompletion").click(function (e){
            e.preventDefault();
            $root.find(".completion").toggle();
        });

        // toggle duration
        $root.find("button.showDuration").click(function (e){
            e.preventDefault();
            $root.find(".duration").toggle();
        });
    }

    // Rendering fn
    /**
     * Computes the data necessary for rendering a task.
     * @param task
     * @returns {Object}
     */
    function taskData(task){
        var ret = DatastoreUtil.getFieldValuesWithId(task);
        var completed = TaskTree.completed(task);
        var percentage = taskCompletion(task);
        var duration = taskDuration(task);

        var prefix = "Open for ";
        if (completed) {
            prefix = "Took ";
        }
        var durationStr = prefix + humanReadable(duration);

        ret.percentage = percentage;
        ret.durationStr = durationStr;
        return ret;
    }

    /**
     * A generic time utility that most certainly doesn't belong here.
     * @param timeMs
     * @returns {string}
     */
    function humanReadable(timeMs) {
        var days, hours, minutes, tmp = (timeMs/1000)/60;
        minutes = parseInt(tmp) % 60;
        tmp = tmp / 60;
        hours = parseInt(tmp) % 24;
        days = parseInt(tmp / 24);
        return days + " days, " + hours + " hours, " + minutes + " minutes";
    }

    /**
     * Returns the duration of the task.  If the task is completed,
     * @param task
     * @returns {number}. Duration of the task in ms.
     */
    function taskDuration(task){
        var startTime = task.get("createTime"), endTime = new Date();
        if (TaskTree.completed(task)) {
            endTime = task.get("completeTime");
        }
        return endTime - startTime;
    }

    /**
     * Returns completion status of this task as a percentage.
     * @param task
     * @returns {number}
     */
    function taskCompletion(task){
        var queryParam = {};
        queryParam[TreeUtil.PARENT_ID_FIELD] = task.getId();
        var subtasks = taskTable.query(queryParam);

        // no subtasks
        if (subtasks.length === 0) {
            if (TaskTree.completed(task)) {
                return 100.0;
            } else {
                return 0.0;
            }
        }

        var weightFn = function(subtask){
            return subtask.get("weight");
        }
        var doneWeight = _.reduce(_.filter(subtasks, function(subtask){
            return TaskTree.completed(subtask);
        }), 0, weightFn);
        var totalWeight = _.reduce(subtasks, 0, weightFn);
        return doneWeight / totalWeight * 100.0;
    }

    /**
     * Renders the task subtree rooted at task (including task itself)
     * @param task. {Datastore.Record}. Task to be rendered
     * @returns {Zepto element}. Zepto selector on div for task. Subtree
     *      rooted at task is fully rendered.
     */
    function renderTask(task){
        console.log("rendering task " + task.get("desc"));
        var data = taskData(task);
        var $task = ich.task(data);

        // render the children and attach
        var children = taskTable.query({parentId: task.getId()});
        var $subtasksList = $task.children(".tasks");
        $subtasksList.empty();
        _.each(children, function(child){
            $subtasksList.append(renderTask(child));
        });

        // attach the task form and hide
        var $taskForm = ich.taskForm();
        $taskForm.hide();
        $task.append($taskForm);

        if (TaskTree.completed(task)) {
            // strikethrough
        }

        return $task;
    }

    // RecordsChanged callbacks
    /**
    *
    * @param task
    * @param $parent
    */
    function taskChangedCb(task) {
        console.log("wtf");
        var $task = renderTask(task);
        addButtonListeners($task);
        var $parent = $main;
        var parentId = task.get(TreeUtil.PARENT_ID_FIELD);
        if (task.get(parentId) !== null) {
            $parent = $("#" + task.get(parentId));
        }
        var $prev = $parent.find("#" + task.getId());
        if ($prev.length === 0) {
            // new task added

            $parent.children(".subtasks").append($task);
        } else {
            // task updated

            $prev.replaceWith($task);
        }
    }

    /**
     *
     * @param parent
     */
    function parentsChangedCb(parent){
        var $old = $("#" + parent.getId());
        var $new = renderTask(parent);
        addButtonListeners($new);
        $old.replaceWith($new);
    }

    /**
     * adds records changed listeners to datastore.
     * @param datastore {Datastore}
     */
    function addRecordsChangedListeners(datastore){
        var rcRootCb = TreeUtil.rcOnRoots(taskTable, taskChangedCb);
        var rcParentCb = TreeUtil.rcOnAffectedParents(taskTable, taskTable, parentsChangedCb);
        datastore.recordsChanged.addListener(rcRootCb);
        datastore.recordsChanged.addListener(rcParentCb);
    }

});

