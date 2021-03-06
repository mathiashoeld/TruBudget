import React, { Component } from "react";
import { connect } from "react-redux";

import {
  markNotificationAsRead,
  fetchNotifications,
  setNotifcationsPerPage,
  setNotificationOffset,
  markMultipleNotificationsAsRead,
  enableLiveUpdates,
  fetchNotificationCounts,
  disableLiveUpdates
} from "./actions";
import NotificationPage from "./NotificationPage";

import globalStyles from "../../styles";
import { toJS } from "../../helper";

class NotificationPageContainer extends Component {
  componentWillMount() {
    this.props.fetchNotifications(this.props.notificationOffset, this.props.notificationsPerPage);
    this.props.disableLiveUpdates();
  }

  componentWillUnmount() {
    this.props.enableLiveUpdates();
    this.props.fetchNotificationCounts();
  }

  render() {
    return (
      <div style={globalStyles.innerContainer}>
        <NotificationPage {...this.props} />
      </div>
    );
  }
}

const mapDispatchToProps = (dispatch, props) => {
  return {
    fetchNotifications: (offset, limit) => dispatch(fetchNotifications(true, offset, limit)),
    markNotificationAsRead: (notificationId, offset, limit) =>
      dispatch(markNotificationAsRead(notificationId, offset, limit)),
    markMultipleNotificationsAsRead: (notificationIds, offset, limit) =>
      dispatch(markMultipleNotificationsAsRead(notificationIds, offset, limit)),
    setNotifcationsPerPage: limit => dispatch(setNotifcationsPerPage(limit)),
    setNotificationOffset: offset => dispatch(setNotificationOffset(offset)),
    enableLiveUpdates: () => dispatch(enableLiveUpdates()),
    disableLiveUpdates: () => dispatch(disableLiveUpdates()),
    fetchNotificationCounts: () => dispatch(fetchNotificationCounts())
  };
};

const mapStateToProps = state => {
  return {
    notifications: state.getIn(["notifications", "notifications"]),
    notificationsPerPage: state.getIn(["notifications", "notificationsPerPage"]),
    unreadNotificationCount: state.getIn(["notifications", "unreadNotificationCount"]),
    notificationCount: state.getIn(["notifications", "notificationCount"]),
    notificationOffset: state.getIn(["notifications", "notificationOffset"])
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(toJS(NotificationPageContainer));
