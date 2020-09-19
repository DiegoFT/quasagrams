<template>
  <q-page class="constrain q-pa-md">
    <transition
      appear
      enter-active-class="animated fadeIn"
      leave-active-class="animated fadeOut">
      <div v-if="showNotificationBanner && pushNotificationsSupported" class="banner-container bg-primary">
        <div class="constrain">
          <q-banner class="bg-grey-3 q-mb-md">
            <template v-slot:avatar>
              <q-icon name="eva-bell-outline" color="primary" />
            </template>

            {{ $t('showNotification') }}

            <template v-slot:action>
              <q-btn
                @click="enableNotification"
                label="Yes"
                color="primary"
                class="q-px-sm"
                dense
                flat />
              <q-btn
                @click="showNotificationBanner = false"
                label="Later"
                color="primary"
                class="q-px-sm"
                dense
                flat />
              <q-btn
                @click="neverShowNotificationBanner"
                label="Never"
                color="primary"
                class="q-px-sm"
                dense
                flat />
            </template>
          </q-banner>
        </div>
      </div>
    </transition>
    <div class="row q-col-gutter-lg">
      <div class="col-12 col-sm-8">
        <template v-if="!loadingPosts && posts.length">
          <q-card
            v-for="post in posts"
            :key="post.id"
            class="card-post q-mb-md"
            :class="{ 'bg-red-1' : post.offline }"
            flat
            bordered>
            <q-badge
              v-if="post.offline"
              color="red"
              class="badge-offline absolute-top-right">
              Stored offline
            </q-badge>
            <q-item>
              <q-item-section avatar>
                <q-avatar>
                  <img src="https://cdn.quasar.dev/img/boy-avatar.png">
                </q-avatar>
              </q-item-section>

              <q-item-section>
                <q-item-label class="text-bold">diegoft</q-item-label>
                <q-item-label caption>
                  {{ post.location }}
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-separator />

            <q-img :src="post.imageUrl" />

            <q-card-section>
              <div>{{ post.caption }}</div>
              <div class="text-caption text-grey">{{ post.date | niceDate }}</div>
            </q-card-section>
          </q-card>
        </template>
        <template v-else-if="!loadingPosts && !posts.length">
          <h5 class="text-center text-grey">{{ $t('noPosts') }}</h5>
        </template>
        <template v-else>
          <q-card flat bordered>
            <q-item>
              <q-item-section avatar>
                <q-skeleton
                  type="QAvatar"
                  animation="fade"
                  size="40px" />
              </q-item-section>

              <q-item-section>
                <q-item-label>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
                <q-item-label caption>
                  <q-skeleton type="text" animation="fade" />
                </q-item-label>
              </q-item-section>
            </q-item>

            <q-skeleton
              height="200px"
              square
              animation="fade" />

            <q-card-section>
              <q-skeleton
                type="text"
                class="text-subtitle2"
                animation="fade" />
              <q-skeleton
                type="text"
                width="50%"
                class="text-subtitle2"
                animation="fade" />
            </q-card-section>
          </q-card>
        </template>
      </div>
      <div class="col-4 large-screen-only">
        <q-item class="fixed">
          <q-item-section avatar>
            <q-avatar size="48px">
              <img src="https://cdn.quasar.dev/img/boy-avatar.png">
            </q-avatar>
          </q-item-section>

          <q-item-section>
            <q-item-label class="text-bold">diegoft</q-item-label>
            <q-item-label caption>
              Diego Forero
            </q-item-label>
          </q-item-section>
        </q-item>
      </div>
    </div>
  </q-page>
</template>

<script>
import {
  date
} from 'quasar'

import {
  openDB
} from 'idb'

export default {
  name: 'PageHome',
  data() {
    return {
      posts: [],
      loadingPosts: false,
      showNotificationBanner: false,
    }
  },
  computed: {
    serviceWorkerSupported() {
      if ('serviceWorker' in navigator) return true
      return false
    },
    pushNotificationsSupported() {
      if ('PushManager' in window) return true
      return false
    },
  },
  methods: {
    getPosts() {
      this.loadingPosts = true
      // setTimeout(() => {
      let url = `${process.env.API}/posts`
      this.$axios.get(url)
        .then(response => {
          this.posts = response.data
          // this.posts = []
          this.loadingPosts = false
          if (!navigator.onLine) {
            this.getOfflinePosts()
          }
        })
        .catch(err => {
          this.$q.dialog({
            title: 'Error',
            message: 'Could not download posts'
          })
          this.loadingPosts = false
        })
      // }, 3000)
    },
    getOfflinePosts() {
      let db = openDB('workbox-background-sync')
        .then(db => {
          db.getAll('requests')
            .then(failedRequests => {
              // console.log('failedRequests: ', failedRequests)
              failedRequests.forEach(failedRequest => {
                if (failedRequest.queueName == 'createPostQueue') {
                  let request = new Request(failedRequest.requestData.url, failedRequest.requestData)
                  request.formData()
                    .then(formData => {
                      let offlinePost = {}
                      offlinePost.id = formData.get('id')
                      offlinePost.caption = formData.get('caption')
                      offlinePost.location = formData.get('location')
                      offlinePost.date = parseInt(formData.get('date'))
                      offlinePost.offline = true

                      let reader = new FileReader()
                      reader.readAsDataURL(formData.get('file'))
                      reader.onloadend = () => {
                        offlinePost.imageUrl = reader.result
                        this.posts.unshift(offlinePost)
                      }
                    })
                }
              })
            })
            .catch(err => {
              console.log('Error accessing IndexDB: ', err)
            })
        })
    },
    listenForOfflinePostUploaded() {
      if (this.serviceWorkerSupported) {
        const channel = new BroadcastChannel('sw-messages')
        channel.addEventListener('message', event => {
          // console.log('Received', event.data)
          if (event.data.msg == 'offline-post-uploaded') {
            let offlinePostCount = this.posts.filter(post => post.offline == true).length
            this.posts[offlinePostCount - 1].offline = false
          }
        })
      }
    },
    enableNotification() {
      // console.log('enableNotification')
      if (this.pushNotificationsSupported) {
        Notification.requestPermission(result => {
          console.log('result', result)
          this.neverShowNotificationBanner()
          if (result == 'granted') {
            this.displayGrantedNotification()
          }
        })
      }
    },
    displayGrantedNotification() {
      new Notification(this.$t('notification'), {
        body: 'Gracias por suscribirte!',
        icon: 'icons\icon-192x192.png',
        image: 'icons\icon-192x192.png', // no supported on Mac, in Android yes
        badge: 'icons\icon-192x192.png', //no supported on Mac, in Android yes
        dir: 'ltr', // text direction - ltr | rtl | auto 
        lang: 'es-ES',
        vibrate: [100, 50, 200], // values in ms -  vibrate during 100ms pause 50ms and vibrate again 200ms
        tag: 'confirm-notification',
        renotify: true // true | false
      })
    },
    neverShowNotificationBanner() {
      this.showNotificationBanner = false
      this.$q.localStorage.set('neverShowNotificationBanner', true)
    },
    notificationBanner() {
      let neverShowNotificationBanner = this.$q.localStorage.getItem('neverShowNotificationBanner')

      if (!neverShowNotificationBanner) {
        this.showNotificationBanner = true
      }
    },
  },
  filters: {
    niceDate(value) {
      return date.formatDate(value, 'D MMMM, H:mm')
    }
  },
  activated() {
    this.getPosts()
  },
  created() {
    this.listenForOfflinePostUploaded()
    this.notificationBanner()
  },
}
</script>

<style lang="sass">
  .card-post
    .badge-offline
      border-top-left-radius: 0 !important
    .q-img
      min-height: 200px
</style>
